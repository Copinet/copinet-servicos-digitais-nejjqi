import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';

interface FileUploadResponse {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  pageCount: number;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

interface MultipleUploadResponse {
  uploads: FileUploadResponse[];
  failed: Array<{ filename: string; error: string; code: string }>;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILENAME_LENGTH = 200;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff in ms

// Sanitize and normalize filename
function sanitizeFilename(filename: string): string {
  // Remove path separators
  let sanitized = filename.replace(/[/\\]/g, '_');

  // Remove special characters, keep only alphanumeric, dots, hyphens, underscores
  sanitized = sanitized.replace(/[^\w.-]/g, '_');

  // Replace multiple underscores with single underscore
  sanitized = sanitized.replace(/_+/g, '_');

  // Limit filename length (keep extension)
  const ext = sanitized.substring(sanitized.lastIndexOf('.'));
  const nameMaxLength = MAX_FILENAME_LENGTH - ext.length;
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    sanitized = sanitized.substring(0, nameMaxLength) + ext;
  }

  return sanitized;
}

// Extract PDF page count
function extractPDFPageCount(buffer: Buffer): number {
  try {
    const content = buffer.toString('latin1');

    // Try to find /Count in /Pages object (most reliable)
    const countMatch = content.match(/\/Pages\s*<<[^>]*\/Count\s*(\d+)/);
    if (countMatch) {
      const count = parseInt(countMatch[1], 10);
      return Math.min(count, 1000); // Cap at 1000 pages
    }

    // Fallback: count /Type /Page occurrences
    const pageMatches = content.match(/\/Type\s*\/Page\s*(?!s)/g);
    if (pageMatches && pageMatches.length > 0) {
      return Math.min(pageMatches.length, 1000);
    }

    // Last resort: check for xref entries
    const xrefMatch = content.match(/xref[\s\S]*?(\d+)\s+0\s+obj/);
    if (xrefMatch) {
      const xrefCount = parseInt(xrefMatch[1], 10);
      if (xrefCount > 0 && xrefCount < 10000) {
        return Math.min(Math.ceil(xrefCount / 10), 1000);
      }
    }

    return 1; // Default to 1 page if cannot determine
  } catch (error) {
    return 1;
  }
}

// Estimate page count for Word documents
function estimateWordPageCount(fileSize: number): number {
  // Rough estimate: approximately 1 page per 50KB
  const estimatedPages = Math.ceil(fileSize / 50000);
  return Math.min(estimatedPages, 1000); // Cap at 1000 pages
}

// Get page count based on file type
function getPageCount(mimeType: string, fileSize?: number, buffer?: Buffer): number {
  // Images count as 1 page each
  if (mimeType.startsWith('image/')) {
    return 1;
  }

  // Word documents - estimate based on file size
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return fileSize ? estimateWordPageCount(fileSize) : 1;
  }

  // PDF - extract from buffer if provided
  if (mimeType === 'application/pdf' && buffer) {
    return extractPDFPageCount(buffer);
  }

  // Default to 1 page
  return 1;
}

// Validate file type
function validateFileType(mimeType: string): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Formato de arquivo não suportado. Tipos aceitos: PDF, imagens (JPEG, PNG, WebP), Word (.doc, .docx)`,
    };
  }
  return { valid: true };
}

// Upload with retry logic
async function uploadWithRetry(
  storage: App['storage'],
  key: string,
  buffer: Buffer,
  logger: App['logger'],
  userId: string,
  filename: string
): Promise<string> {
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const uploadedKey = await storage.upload(key, buffer);
      logger.info({ userId, filename, attempt: attempt + 1 }, 'File uploaded to storage');
      return uploadedKey;
    } catch (error) {
      logger.warn(
        { userId, filename, attempt: attempt + 1, err: error },
        `Upload attempt ${attempt + 1} failed`
      );

      if (attempt < RETRY_ATTEMPTS - 1) {
        // Wait before retrying with exponential backoff
        const delay = RETRY_DELAYS[attempt];
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // All retries exhausted
        throw new Error('Falha ao salvar arquivo após múltiplas tentativas');
      }
    }
  }
  throw new Error('Erro desconhecido no upload');
}

export function registerUploadRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // POST /api/upload/document - Upload single document with streaming support
  fastify.post('/api/upload/document', {
    schema: {
      description: 'Upload a document with streaming support for large files (até 100MB)',
      tags: ['upload'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            url: { type: 'string' },
            filename: { type: 'string' },
            size: { type: 'number' },
            mimeType: { type: 'string' },
            pageCount: { type: 'number' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Iniciando upload de documento');

    try {
      const data = await request.file();
      if (!data) {
        app.logger.warn({ userId }, 'Nenhum arquivo fornecido para upload');
        return reply.status(400).send({
          success: false,
          error: 'Nenhum arquivo foi enviado',
          code: 'NO_FILE',
        } as ErrorResponse);
      }

      // Validate file type first
      const typeValidation = validateFileType(data.mimetype);
      if (!typeValidation.valid) {
        app.logger.warn(
          { userId, filename: data.filename, mimeType: data.mimetype },
          'Tipo de arquivo inválido'
        );
        return reply.status(400).send({
          success: false,
          error: typeValidation.error || 'Tipo de arquivo inválido',
          code: 'INVALID_FORMAT',
        } as ErrorResponse);
      }

      let buffer: Buffer;
      let totalSize = 0;
      const chunks: Buffer[] = [];

      try {
        // Stream and collect buffer with size checking
        for await (const chunk of data.file) {
          totalSize += chunk.length;

          // Check size limit during streaming
          if (totalSize > MAX_FILE_SIZE) {
            app.logger.error(
              { userId, filename: data.filename, size: totalSize },
              'Tamanho de arquivo excedido'
            );
            return reply.status(413).send({
              success: false,
              error: `Arquivo muito grande. Tamanho máximo: 100MB (você enviou ${(totalSize / 1024 / 1024).toFixed(2)}MB)`,
              code: 'FILE_TOO_LARGE',
            } as ErrorResponse);
          }

          chunks.push(chunk);
        }

        buffer = Buffer.concat(chunks);
        app.logger.info({ userId, filename: data.filename, size: totalSize }, 'Buffer criado com sucesso');
      } catch (err) {
        app.logger.error({ err, userId, filename: data.filename }, 'Falha ao ler stream do arquivo');
        return reply.status(400).send({
          success: false,
          error: 'Erro ao ler o arquivo. Por favor, tente novamente.',
          code: 'PROCESSING_FAILED',
        } as ErrorResponse);
      }

      try {
        // Sanitize filename
        const sanitizedFilename = sanitizeFilename(data.filename);
        const timestamp = Date.now();
        const finalFilename = `${timestamp}-${sanitizedFilename}`;
        const key = `documents/${userId}/${finalFilename}`;

        app.logger.info(
          { userId, originalFilename: data.filename, sanitizedFilename, size: buffer.length },
          'Iniciando processamento de upload'
        );

        // Get page count based on file type
        let pageCount = 1;
        if (data.mimetype === 'application/pdf') {
          pageCount = extractPDFPageCount(buffer);
        } else if (
          data.mimetype === 'application/msword' ||
          data.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) {
          pageCount = estimateWordPageCount(buffer.length);
        }

        app.logger.info(
          { userId, filename: finalFilename, pageCount },
          `Contagem de páginas: ${pageCount}`
        );

        // Upload to storage with retry logic
        let uploadedKey: string;
        try {
          uploadedKey = await uploadWithRetry(app.storage, key, buffer, app.logger, userId, finalFilename);
        } catch (storageErr) {
          app.logger.error({ err: storageErr, userId, filename: finalFilename }, 'Falha no upload ao armazenamento');
          return reply.status(500).send({
            success: false,
            error: 'Erro ao salvar arquivo no armazenamento. Por favor, tente novamente.',
            code: 'PROCESSING_FAILED',
          } as ErrorResponse);
        }

        // Generate signed URL
        const { url } = await app.storage.getSignedUrl(uploadedKey);

        app.logger.info(
          { userId, filename: finalFilename, pageCount, size: buffer.length },
          'Documento uploaded com sucesso'
        );

        return {
          success: true,
          url,
          filename: data.filename,
          size: buffer.length,
          mimeType: data.mimetype,
          pageCount,
        };
      } catch (error) {
        app.logger.error(
          { err: error, userId, filename: data.filename, stack: (error as Error).stack },
          'Falha ao processar upload de documento'
        );
        return reply.status(500).send({
          success: false,
          error: 'Erro ao processar o documento. Por favor, tente novamente.',
          code: 'PROCESSING_FAILED',
        } as ErrorResponse);
      }
    } catch (error) {
      app.logger.error(
        { err: error, userId: session?.user.id, stack: (error as Error).stack },
        'Erro no endpoint de upload'
      );
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor. Por favor, tente novamente mais tarde.',
        code: 'PROCESSING_FAILED',
      } as ErrorResponse);
    }
  });

  // POST /api/upload/multiple - Upload multiple files in parallel
  fastify.post('/api/upload/multiple', {
    schema: {
      description: 'Upload de múltiplos documentos com processamento paralelo (até 10 arquivos, máx 100MB cada)',
      tags: ['upload'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            uploads: { type: 'array' },
            failed: { type: 'array' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Iniciando upload de múltiplos arquivos');

    const uploadedFiles: FileUploadResponse[] = [];
    const failedFiles: Array<{ filename: string; error: string; code: string }> = [];
    let fileCount = 0;

    try {
      const files = await request.files();
      const uploadPromises = [];

      for await (const fileData of files) {
        fileCount++;

        // Limit to 10 simultaneous files
        if (fileCount > 10) {
          app.logger.warn({ userId, filename: fileData.filename }, 'Limite de arquivos excedido (máx 10)');
          failedFiles.push({
            filename: fileData.filename,
            error: 'Limite de 10 arquivos excedido',
            code: 'TOO_MANY_FILES',
          });
          continue;
        }

        // Create promise for each file upload
        const uploadPromise = (async () => {
          try {
            // Validate file type
            const typeValidation = validateFileType(fileData.mimetype);
            if (!typeValidation.valid) {
              app.logger.warn({ userId, filename: fileData.filename }, 'Tipo de arquivo inválido');
              failedFiles.push({
                filename: fileData.filename,
                error: typeValidation.error || 'Tipo de arquivo inválido',
                code: 'INVALID_FORMAT',
              });
              return;
            }

            let buffer: Buffer;
            let totalSize = 0;

            try {
              const chunks: Buffer[] = [];
              for await (const chunk of fileData.file) {
                totalSize += chunk.length;
                if (totalSize > MAX_FILE_SIZE) {
                  app.logger.warn(
                    { userId, filename: fileData.filename, size: totalSize },
                    'Tamanho de arquivo excedido'
                  );
                  failedFiles.push({
                    filename: fileData.filename,
                    error: `Arquivo muito grande (${(totalSize / 1024 / 1024).toFixed(2)}MB). Máximo: 100MB`,
                    code: 'FILE_TOO_LARGE',
                  });
                  return;
                }
                chunks.push(chunk);
              }
              buffer = Buffer.concat(chunks);
            } catch (err) {
              app.logger.error({ err, userId, filename: fileData.filename }, 'Falha ao ler arquivo');
              failedFiles.push({
                filename: fileData.filename,
                error: 'Erro ao ler o arquivo',
                code: 'PROCESSING_FAILED',
              });
              return;
            }

            const sanitizedFilename = sanitizeFilename(fileData.filename);
            const timestamp = Date.now();
            const finalFilename = `${timestamp}-${sanitizedFilename}`;
            const key = `documents/${userId}/${finalFilename}`;

            // Extract page count
            let pageCount = 1;
            if (fileData.mimetype === 'application/pdf') {
              pageCount = extractPDFPageCount(buffer);
            } else if (
              fileData.mimetype === 'application/msword' ||
              fileData.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ) {
              pageCount = estimateWordPageCount(buffer.length);
            }

            // Upload to storage with retry
            const uploadedKey = await uploadWithRetry(
              app.storage,
              key,
              buffer,
              app.logger,
              userId,
              finalFilename
            );
            const { url } = await app.storage.getSignedUrl(uploadedKey);

            uploadedFiles.push({
              url,
              filename: fileData.filename,
              size: buffer.length,
              mimeType: fileData.mimetype,
              pageCount,
            });

            app.logger.info({ userId, filename: finalFilename, pageCount }, 'Arquivo uploaded com sucesso');
          } catch (error) {
            app.logger.error(
              { err: error, filename: fileData.filename, stack: (error as Error).stack },
              'Falha no upload do arquivo'
            );
            failedFiles.push({
              filename: fileData.filename,
              error: 'Erro ao fazer upload do arquivo',
              code: 'PROCESSING_FAILED',
            });
          }
        })();

        uploadPromises.push(uploadPromise);
      }

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);

      app.logger.info(
        { userId, uploaded: uploadedFiles.length, failed: failedFiles.length },
        'Upload de múltiplos arquivos concluído'
      );

      return {
        uploads: uploadedFiles,
        failed: failedFiles,
      } as MultipleUploadResponse;
    } catch (error) {
      app.logger.error(
        { err: error, userId, stack: (error as Error).stack },
        'Erro no endpoint de múltiplos uploads'
      );
      return reply.status(500).send({
        uploads: uploadedFiles,
        failed: [
          ...failedFiles,
          {
            filename: 'unknown',
            error: 'Erro geral do servidor ao processar uploads',
            code: 'PROCESSING_FAILED',
          },
        ],
      } as MultipleUploadResponse);
    }
  });
}
