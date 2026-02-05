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
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// Simple PDF page count extractor (counts /Page or /Pages objects)
function extractPDFPageCount(buffer: Buffer): number {
  try {
    const content = buffer.toString('latin1');
    // This is a simplified approach - counts /Type /Page occurrences
    const pageMatches = content.match(/\/Type\s*\/Page\s*(?!s)/g);
    if (pageMatches) {
      return Math.min(pageMatches.length, 1000); // Cap at 1000 pages
    }
    // Fallback: try to find /Count in /Pages object
    const countMatch = content.match(/\/Pages\s*<<[^>]*\/Count\s*(\d+)/);
    if (countMatch) {
      return Math.min(parseInt(countMatch[1], 10), 1000);
    }
    return 1; // Default to 1 page if cannot determine
  } catch (error) {
    return 1;
  }
}

// Validate file type
function validateFileType(mimeType: string): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Formato de arquivo não suportado. Tipos aceitos: PDF, imagens (JPEG, PNG, WebP), Word`,
    };
  }
  return { valid: true };
}

// Determine page count based on file type
function getPageCount(mimeType: string): number {
  // Images count as 1 page each
  if (mimeType.startsWith('image/')) {
    return 1;
  }
  // Documents default to 1 page (will be overridden for PDFs)
  return 1;
}

export function registerUploadRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // POST /api/upload/document - Upload single document with streaming support
  fastify.post('/api/upload/document', {
    schema: {
      description: 'Upload a document with streaming support for large files',
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
    app.logger.info({ userId }, 'Starting document upload');

    try {
      const data = await request.file();
      if (!data) {
        app.logger.warn({ userId }, 'No file provided for upload');
        return reply.status(400).send({
          success: false,
          error: 'Nenhum arquivo foi enviado',
          code: 'NO_FILE',
        } as ErrorResponse);
      }

      // Validate file type
      const typeValidation = validateFileType(data.mimetype);
      if (!typeValidation.valid) {
        app.logger.warn({ userId, filename: data.filename, mimeType: data.mimetype }, 'Invalid file type');
        return reply.status(400).send({
          success: false,
          error: typeValidation.error || 'Tipo de arquivo inválido',
          code: 'INVALID_FORMAT',
        } as ErrorResponse);
      }

      let buffer: Buffer;
      let totalSize = 0;

      try {
        // Stream and collect buffer with size checking
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
          totalSize += chunk.length;
          if (totalSize > MAX_FILE_SIZE) {
            app.logger.error({ userId, filename: data.filename, size: totalSize }, 'File size exceeded');
            return reply.status(413).send({
              success: false,
              error: `Arquivo muito grande. Tamanho máximo: 100MB (você enviou ${(totalSize / 1024 / 1024).toFixed(1)}MB)`,
              code: 'FILE_TOO_LARGE',
            } as ErrorResponse);
          }
          chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
      } catch (err) {
        app.logger.error({ err, userId, filename: data.filename }, 'Failed to read file stream');
        return reply.status(400).send({
          success: false,
          error: 'Erro ao ler o arquivo. Por favor, tente novamente.',
          code: 'PROCESSING_FAILED',
        } as ErrorResponse);
      }

      try {
        const timestamp = Date.now();
        const filename = `${timestamp}-${data.filename}`;
        const key = `documents/${userId}/${filename}`;

        // Extract page count for PDFs
        let pageCount = getPageCount(data.mimetype);
        if (data.mimetype === 'application/pdf') {
          pageCount = extractPDFPageCount(buffer);
        }

        // Upload to storage with retry logic
        let uploadedKey: string;
        try {
          uploadedKey = await app.storage.upload(key, buffer);
        } catch (storageErr) {
          app.logger.error({ err: storageErr, userId, filename }, 'Storage upload failed');
          throw new Error('Erro ao salvar arquivo no armazenamento');
        }

        app.logger.info({ userId, filename, pageCount, size: buffer.length }, 'Document uploaded to storage');

        // Generate signed URL
        const { url } = await app.storage.getSignedUrl(uploadedKey);
        app.logger.info({ userId, filename }, 'Signed URL generated');

        return {
          success: true,
          url,
          filename: data.filename,
          size: buffer.length,
          mimeType: data.mimetype,
          pageCount,
        };
      } catch (error) {
        app.logger.error({ err: error, userId, filename: data.filename }, 'Document upload processing failed');
        return reply.status(500).send({
          success: false,
          error: 'Erro ao processar o documento. Por favor, tente novamente.',
          code: 'PROCESSING_FAILED',
        } as ErrorResponse);
      }
    } catch (error) {
      app.logger.error({ err: error, userId: session?.user.id }, 'Upload endpoint error');
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
      description: 'Upload multiple documents with parallel processing',
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
    app.logger.info({ userId }, 'Starting multiple file upload');

    const uploadedFiles: FileUploadResponse[] = [];
    const failedFiles: Array<{ filename: string; error: string; code: string }> = [];

    try {
      const files = await request.files();
      const uploadPromises = [];

      for await (const fileData of files) {
        // Create promise for each file upload
        const uploadPromise = (async () => {
          try {
            // Validate file type
            const typeValidation = validateFileType(fileData.mimetype);
            if (!typeValidation.valid) {
              app.logger.warn({ userId, filename: fileData.filename }, 'Invalid file type');
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
                  app.logger.warn({ userId, filename: fileData.filename, size: totalSize }, 'File size exceeded');
                  failedFiles.push({
                    filename: fileData.filename,
                    error: `Arquivo muito grande (${(totalSize / 1024 / 1024).toFixed(1)}MB). Máximo: 100MB`,
                    code: 'FILE_TOO_LARGE',
                  });
                  return;
                }
                chunks.push(chunk);
              }
              buffer = Buffer.concat(chunks);
            } catch (err) {
              app.logger.error({ err, userId, filename: fileData.filename }, 'Failed to read file');
              failedFiles.push({
                filename: fileData.filename,
                error: 'Erro ao ler o arquivo',
                code: 'PROCESSING_FAILED',
              });
              return;
            }

            const timestamp = Date.now();
            const filename = `${timestamp}-${fileData.filename}`;
            const key = `documents/${userId}/${filename}`;

            // Extract page count
            let pageCount = getPageCount(fileData.mimetype);
            if (fileData.mimetype === 'application/pdf') {
              pageCount = extractPDFPageCount(buffer);
            }

            // Upload to storage
            const uploadedKey = await app.storage.upload(key, buffer);
            const { url } = await app.storage.getSignedUrl(uploadedKey);

            uploadedFiles.push({
              url,
              filename: fileData.filename,
              size: buffer.length,
              mimeType: fileData.mimetype,
              pageCount,
            });

            app.logger.info({ userId, filename, pageCount }, 'File uploaded successfully');
          } catch (error) {
            app.logger.error({ err: error, filename: fileData.filename }, 'File upload failed');
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

      app.logger.info({ userId, uploaded: uploadedFiles.length, failed: failedFiles.length }, 'Multiple file upload completed');
      return {
        uploads: uploadedFiles,
        failed: failedFiles,
      } as MultipleUploadResponse;
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Multiple upload endpoint error');
      return reply.status(500).send({
        uploads: uploadedFiles,
        failed: [...failedFiles, { filename: 'unknown', error: 'Erro geral do servidor', code: 'PROCESSING_FAILED' }],
      } as MultipleUploadResponse);
    }
  });
}
