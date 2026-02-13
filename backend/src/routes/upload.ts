import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';

interface FileUploadResponse {
  success: true;
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
const MAX_PDF_PAGES = 2000;
const MAX_FILENAME_LENGTH = 200;
const UPLOAD_TIMEOUT = 3 * 60 * 1000; // 3 minutes
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
  let sanitized = filename.replace(/[/\\]/g, '_');
  sanitized = sanitized.replace(/[^\w.-]/g, '_');
  sanitized = sanitized.replace(/_+/g, '_');

  const ext = sanitized.substring(sanitized.lastIndexOf('.'));
  const nameMaxLength = MAX_FILENAME_LENGTH - ext.length;
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    sanitized = sanitized.substring(0, nameMaxLength) + ext;
  }

  return sanitized;
}

// Extract PDF page count - SINGLE strategy per execution (NO SUMMING)
function extractPDFPageCount(buffer: Buffer): { pageCount: number; strategy: string } {
  try {
    // Convert to string using latin1 encoding (preserves binary data as-is)
    const content = buffer.toString('latin1');

    // STRATEGY 1: Catalog /Pages object (MOST RELIABLE)
    // This is the official PDF way to store total page count
    const catalogMatch = content.match(/\/Type\s*\/Catalog[\s\S]*?\/Pages\s+(\d+)\s+0\s+R/);
    if (catalogMatch) {
      const pageTreeObjNum = parseInt(catalogMatch[1], 10);
      const pageTreeRegex = new RegExp(
        pageTreeObjNum + '\\s+0\\s+obj[\\s\\S]*?/Type\\s*/Pages[\\s\\S]*?/Count\\s+(\\d+)',
        'i'
      );
      const pageTreeMatch = content.match(pageTreeRegex);
      if (pageTreeMatch) {
        const pageCount = parseInt(pageTreeMatch[1], 10);
        if (pageCount > 0) {
          // RETURN IMMEDIATELY - strategy worked
          return { pageCount: Math.min(pageCount, MAX_PDF_PAGES), strategy: 'Catalog' };
        }
      }
    }

    // STRATEGY 2: Direct /Pages with /Count (FALLBACK)
    const directPagesMatch = content.match(/\/Type\s*\/Pages[\s\S]{0,500}?\/Count\s+(\d+)/i);
    if (directPagesMatch) {
      const pageCount = parseInt(directPagesMatch[1], 10);
      if (pageCount > 0) {
        // RETURN IMMEDIATELY - strategy worked
        return { pageCount: Math.min(pageCount, MAX_PDF_PAGES), strategy: 'Direct' };
      }
    }

    // STRATEGY 3: Count /Type /Page objects (FALLBACK)
    // Only counts single /Page objects, NOT /Pages (using negative lookahead)
    const pageObjMatches = content.match(/\/Type\s*\/Page(?!s)\s*[\n\r\s]/gi);
    if (pageObjMatches && pageObjMatches.length > 0) {
      const pageCount = pageObjMatches.length;
      if (pageCount > 0) {
        // RETURN IMMEDIATELY - strategy worked
        return { pageCount: Math.min(pageCount, MAX_PDF_PAGES), strategy: 'PageObjects' };
      }
    }

    // STRATEGY 4: File size estimation (LAST RESORT)
    // Only use if all other strategies failed
    // PDFs average ~10KB per page when compressed
    if (buffer.length > 5000) {
      const estimatedPages = Math.ceil(buffer.length / 10000);
      if (estimatedPages > 0) {
        // RETURN IMMEDIATELY - last resort
        return { pageCount: Math.min(estimatedPages, MAX_PDF_PAGES), strategy: 'Estimation' };
      }
    }

    // Fallback: 1 page
    return { pageCount: 1, strategy: 'Fallback' };
  } catch (error) {
    // On any error, return 1 page minimum
    return { pageCount: 1, strategy: 'Error' };
  }
}

// Estimate page count for Word documents
function estimateWordPageCount(buffer: Buffer, mimeType: string, logger?: any): number {
  try {
    // For .docx files, try to extract actual content
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // .docx is a ZIP file, try to find document.xml
      const docXmlStart = buffer.indexOf(Buffer.from('<?xml'));
      if (docXmlStart !== -1) {
        // Found XML content
        const contentLength = buffer.length - docXmlStart;
        // Estimate: ~2200 characters per page (.docx standard)
        const estimatedPages = Math.max(1, Math.ceil(contentLength / 2200));
        if (estimatedPages > 0) {
          if (logger) {
            logger.info(
              { mimeType: '.docx', contentLength, estimatedPages },
              `Word page count: ${estimatedPages} pages using estimation for .docx`
            );
          }
          return Math.min(estimatedPages, MAX_PDF_PAGES);
        }
      }
    }

    // Fallback for .doc or if XML not found in .docx
    // .doc files: estimate ~15KB per page (binary format)
    const estimatedPages = Math.max(1, Math.ceil(buffer.length / 15000));
    const docType = mimeType === 'application/msword' ? '.doc' : '.docx';
    if (logger) {
      logger.info(
        { mimeType: docType, bufferSize: buffer.length, estimatedPages },
        `Word page count: ${estimatedPages} pages using estimation for ${docType}`
      );
    }
    return Math.min(estimatedPages, MAX_PDF_PAGES);
  } catch (error) {
    // On error, use conservative file size estimate
    const estimatedPages = Math.max(1, Math.ceil(buffer.length / 15000));
    if (logger) {
      logger.info(
        { bufferSize: buffer.length, estimatedPages, error: (error as Error).message },
        `Word page count: ${estimatedPages} pages using fallback estimation`
      );
    }
    return Math.min(estimatedPages, MAX_PDF_PAGES);
  }
}

// Validate file type
function validateFileType(mimeType: string): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Formato não suportado. Aceitos: PDF, imagens (JPEG, PNG, WebP), Word`,
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
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      logger.info({ userId, filename, attempt: attempt + 1, keyPath: key }, 'Iniciando upload para storage');
      const uploadedKey = await storage.upload(key, buffer);
      logger.info({ userId, filename, attempt: attempt + 1, uploadedKey }, 'Upload para storage concluído');
      return uploadedKey;
    } catch (error) {
      lastError = error as Error;
      const errorMsg = lastError.message || '';
      const errorStr = String(error);

      logger.warn(
        {
          userId,
          filename,
          attempt: attempt + 1,
          error: errorMsg,
          errorFull: errorStr,
          statusCode: (error as any)?.status || (error as any)?.statusCode,
        },
        `Tentativa ${attempt + 1} falhou: ${errorMsg}`
      );

      if (attempt < RETRY_ATTEMPTS - 1) {
        const delay = RETRY_DELAYS[attempt];
        logger.info({ userId, filename, delay }, `Aguardando ${delay}ms antes de nova tentativa`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  const finalError = lastError || new Error('Falha ao salvar arquivo');
  logger.error(
    { userId, filename, errorMsg: finalError.message },
    `Falha definitiva no upload após ${RETRY_ATTEMPTS} tentativas`
  );
  throw finalError;
}

export function registerUploadRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // POST /api/upload/document - Single document upload with timeout
  fastify.post<{ Reply: FileUploadResponse | ErrorResponse }>(
    '/api/upload/document',
    {
      schema: {
        description: 'Upload documento (PDF, imagens, Word) até 150MB',
        tags: ['upload'],
        consumes: ['multipart/form-data'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Ensure JSON response on error
      reply.type('application/json');

      // Extract authorization header for debugging
      const authHeader = request.headers.authorization;
      app.logger.info({ authHeader: authHeader ? 'present' : 'missing' }, 'Upload request received');

      const session = await requireAuth(request, reply);
      if (!session) {
        app.logger.error({ authHeader }, 'Authentication failed - no session');
        return;
      }

      const userId = session.user.id;
      app.logger.info({ userId }, 'Iniciando upload de documento');

      // Set timeout for entire operation
      const timeoutId = setTimeout(() => {
        if (!reply.sent) {
          app.logger.error({ userId }, 'Upload timeout após 5 minutos');
          reply.status(408).send({
            success: false,
            error: 'Upload excedeu tempo limite de 5 minutos',
            code: 'UPLOAD_TIMEOUT',
          } as ErrorResponse);
        }
      }, UPLOAD_TIMEOUT);

      try {
        let data;
        try {
          data = await request.file();
        } catch (fileError) {
          const errorMsg = (fileError as Error).message || '';
          app.logger.error(
            { userId, error: errorMsg },
            'Erro ao receber arquivo'
          );

          // Check for payload too large errors
          if (
            errorMsg.includes('413') ||
            errorMsg.includes('Payload Too Large') ||
            errorMsg.includes('payloadTooLarge') ||
            errorMsg.includes('exceed')
          ) {
            app.logger.warn({ userId, error: errorMsg }, 'Payload too large for single upload');
            return reply.status(413).send({
              success: false,
              error: 'Arquivo muito grande',
              code: 'PAYLOAD_TOO_LARGE',
            } as ErrorResponse);
          }

          return reply.status(400).send({
            success: false,
            error: 'Erro ao receber arquivo. Tente novamente.',
            code: 'FILE_RECEIVE_ERROR',
          } as ErrorResponse);
        }

        if (!data) {
          app.logger.warn({ userId }, 'Arquivo não fornecido na request');
          return reply.status(400).send({
            success: false,
            error: 'Nenhum arquivo foi enviado',
            code: 'NO_FILE',
          } as ErrorResponse);
        }

        app.logger.info(
          { userId, filename: data.filename, mimeType: data.mimetype, encoding: data.encoding },
          'Arquivo recebido na request'
        );

        // Validate file type
        const typeValidation = validateFileType(data.mimetype);
        if (!typeValidation.valid) {
          app.logger.warn({ userId, mimeType: data.mimetype }, 'Tipo de arquivo não permitido');
          return reply.status(400).send({
            success: false,
            error: typeValidation.error || 'Tipo de arquivo inválido',
            code: 'INVALID_FORMAT',
          } as ErrorResponse);
        }

        const chunks: Buffer[] = [];
        let totalSize = 0;

        // Stream file with size checking
        for await (const chunk of data.file) {
          totalSize += chunk.length;

          if (totalSize > MAX_FILE_SIZE) {
            app.logger.error(
              { userId, size: totalSize, limit: MAX_FILE_SIZE },
              'Arquivo muito grande'
            );
            return reply.status(413).send({
              success: false,
              error: `Arquivo muito grande (${(totalSize / 1024 / 1024).toFixed(1)}MB). Máximo permitido: 100MB. Por favor, reduza o tamanho do arquivo ou envie em partes.`,
              code: 'FILE_TOO_LARGE',
            } as ErrorResponse);
          }

          chunks.push(chunk);
        }

        const buffer = Buffer.concat(chunks);
        const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
        app.logger.info(
          { userId, size: buffer.length, chunks: chunks.length, fileSizeMB },
          `Buffer criado: ${fileSizeMB}MB em ${chunks.length} chunks`
        );

        // Sanitize filename
        const sanitized = sanitizeFilename(data.filename);
        const timestamp = Date.now();
        const finalFilename = `${timestamp}-${sanitized}`;
        const key = `documents/${userId}/${finalFilename}`;

        app.logger.info(
          { userId, originalFilename: data.filename, sanitized, finalFilename, storageKey: key },
          'Preparando para armazenar arquivo'
        );

        // Extract page count with detailed logging
        let pageCount = 1;
        app.logger.info(
          { userId, filename: finalFilename, mimeType: data.mimetype, size: buffer.length },
          'Iniciando detecção de número de páginas'
        );

        if (data.mimetype === 'application/pdf') {
          const pdfResult = extractPDFPageCount(buffer);
          pageCount = pdfResult.pageCount;
          app.logger.info(
            {
              userId,
              filename: finalFilename,
              detectedPages: pageCount,
              strategy: pdfResult.strategy,
              bufferSize: buffer.length,
              fileSizeMB: (buffer.length / 1024 / 1024).toFixed(2)
            },
            `PDF page count: ${pageCount} pages using strategy: ${pdfResult.strategy}`
          );
        } else if (
          data.mimetype === 'application/msword' ||
          data.mimetype ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) {
          pageCount = estimateWordPageCount(buffer, data.mimetype, app.logger);
          const docType = data.mimetype === 'application/msword' ? '.doc' : '.docx';
          app.logger.info(
            { userId, filename: finalFilename, docType, estimatedPages: pageCount, bufferSize: buffer.length },
            `Word document (${docType}) page estimation completed`
          );
        }

        app.logger.info(
          { userId, filename: finalFilename, pageCount, size: buffer.length, mimeType: data.mimetype },
          `Detecção concluída: ${pageCount} páginas identificadas`
        );

        // Upload with retries
        let uploadedKey: string;
        try {
          uploadedKey = await uploadWithRetry(
            app.storage,
            key,
            buffer,
            app.logger,
            userId,
            finalFilename
          );
        } catch (storageErr) {
          const errorMsg = (storageErr as Error).message || '';
          app.logger.error(
            { userId, filename: finalFilename, error: errorMsg, errorType: storageErr?.constructor?.name },
            'Erro ao fazer upload para storage'
          );

          // Check for specific storage errors
          if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('permission')) {
            return reply.status(401).send({
              success: false,
              error: 'Não autorizado para fazer upload. Verifique sua autenticação.',
              code: 'STORAGE_UNAUTHORIZED',
            } as ErrorResponse);
          }

          if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return reply.status(403).send({
              success: false,
              error: 'Acesso negado ao armazenamento. Contate o suporte.',
              code: 'STORAGE_PERMISSION_DENIED',
            } as ErrorResponse);
          }

          return reply.status(500).send({
            success: false,
            error: 'Erro ao salvar arquivo. Tente novamente.',
            code: 'STORAGE_ERROR',
          } as ErrorResponse);
        }

        // Get signed URL
        const { url } = await app.storage.getSignedUrl(uploadedKey);

        const uploadedSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
        app.logger.info(
          {
            userId,
            filename: finalFilename,
            pageCount,
            uploadedSize: buffer.length,
            uploadedSizeMB,
            mimeType: data.mimetype
          },
          `Upload concluído: ${uploadedSizeMB}MB - Contagem de páginas do backend: ${pageCount} páginas para arquivo ${data.filename}`
        );

        clearTimeout(timeoutId);
        return reply.send({
          success: true,
          url,
          filename: data.filename,
          size: buffer.length,
          mimeType: data.mimetype,
          pageCount,
        } as FileUploadResponse);
      } catch (error) {
        app.logger.error(
          { userId, error: (error as Error).message },
          'Erro no endpoint'
        );
        clearTimeout(timeoutId);
        return reply.status(500).send({
          success: false,
          error: 'Erro ao processar upload. Tente novamente.',
          code: 'PROCESSING_ERROR',
        } as ErrorResponse);
      }
    }
  );

  // POST /api/upload/multiple - Multiple files in parallel
  fastify.post<{ Reply: MultipleUploadResponse }>(
    '/api/upload/multiple',
    {
      schema: {
        description: 'Upload múltiplos documentos (max 10 arquivos, 150MB cada)',
        tags: ['upload'],
        consumes: ['multipart/form-data'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Ensure JSON response
      reply.type('application/json');

      // Extract authorization header for debugging
      const authHeader = request.headers.authorization;
      app.logger.info({ authHeader: authHeader ? 'present' : 'missing' }, 'Multiple upload request received');

      const session = await requireAuth(request, reply);
      if (!session) {
        app.logger.error({ authHeader }, 'Authentication failed for multiple upload');
        return;
      }

      const userId = session.user.id;
      app.logger.info({ userId }, 'Upload múltiplo iniciado');

      const uploadedFiles: FileUploadResponse[] = [];
      const failedFiles: Array<{ filename: string; error: string; code: string }> = [];

      // Set timeout for entire operation
      const timeoutId = setTimeout(() => {
        if (!reply.sent) {
          app.logger.error({ userId }, 'Upload múltiplo timeout');
          reply.status(408).send({
            uploads: uploadedFiles,
            failed: [
              ...failedFiles,
              {
                filename: 'todos',
                error: 'Upload excedeu tempo limite',
                code: 'UPLOAD_TIMEOUT',
              },
            ],
          } as MultipleUploadResponse);
        }
      }, UPLOAD_TIMEOUT);

      try {
        let files;
        try {
          files = await request.files();
        } catch (filesError) {
          const errorMsg = (filesError as Error).message || '';
          app.logger.error(
            { userId, error: errorMsg },
            'Erro ao receber múltiplos arquivos'
          );

          // Check for payload too large errors
          if (
            errorMsg.includes('413') ||
            errorMsg.includes('Payload Too Large') ||
            errorMsg.includes('payloadTooLarge')
          ) {
            app.logger.warn({ userId, error: errorMsg }, 'Payload too large for multiple upload');
            clearTimeout(timeoutId);
            return reply.status(413).send({
              uploads: [],
              failed: [
                {
                  filename: 'todos',
                  error: 'Arquivo muito grande',
                  code: 'PAYLOAD_TOO_LARGE',
                },
              ],
            } as MultipleUploadResponse);
          }

          clearTimeout(timeoutId);
          return reply.status(400).send({
            uploads: [],
            failed: [
              {
                filename: 'todos',
                error: 'Erro ao receber arquivos. Tente novamente.',
                code: 'FILES_RECEIVE_ERROR',
              },
            ],
          } as MultipleUploadResponse);
        }

        const uploadPromises = [];
        let fileCount = 0;

        for await (const fileData of files) {
          fileCount++;

          // Limit to 10 files
          if (fileCount > 10) {
            app.logger.warn({ userId }, 'Limite de 10 arquivos excedido');
            failedFiles.push({
              filename: fileData.filename,
              error: 'Máximo de 10 arquivos',
              code: 'TOO_MANY_FILES',
            });
            continue;
          }

          // Create upload promise
          const uploadPromise = (async () => {
            try {
              // Validate type
              const typeValidation = validateFileType(fileData.mimetype);
              if (!typeValidation.valid) {
                failedFiles.push({
                  filename: fileData.filename,
                  error: typeValidation.error || 'Tipo inválido',
                  code: 'INVALID_FORMAT',
                });
                return;
              }

              const chunks: Buffer[] = [];
              let totalSize = 0;

              // Stream with size check
              for await (const chunk of fileData.file) {
                totalSize += chunk.length;

                if (totalSize > MAX_FILE_SIZE) {
                  app.logger.warn(
                    { userId, filename: fileData.filename, size: totalSize, limit: MAX_FILE_SIZE },
                    'Arquivo muito grande'
                  );
                  failedFiles.push({
                    filename: fileData.filename,
                    error: `Arquivo muito grande (${(totalSize / 1024 / 1024).toFixed(1)}MB). Máximo: 100MB`,
                    code: 'FILE_TOO_LARGE',
                  });
                  return;
                }

                chunks.push(chunk);
              }

              const buffer = Buffer.concat(chunks);

              const sanitized = sanitizeFilename(fileData.filename);
              const timestamp = Date.now();
              const finalFilename = `${timestamp}-${sanitized}`;
              const key = `documents/${userId}/${finalFilename}`;

              // Extract pages with logging
              let pageCount = 1;
              app.logger.info(
                { userId, filename: fileData.filename, mimeType: fileData.mimetype, size: buffer.length },
                'Iniciando detecção de página (múltiplo)'
              );

              if (fileData.mimetype === 'application/pdf') {
                const pdfResult = extractPDFPageCount(buffer);
                pageCount = pdfResult.pageCount;
                app.logger.info(
                  {
                    userId,
                    filename: fileData.filename,
                    detectedPages: pageCount,
                    strategy: pdfResult.strategy,
                    bufferSize: buffer.length,
                    fileSizeMB: (buffer.length / 1024 / 1024).toFixed(2)
                  },
                  `PDF page count: ${pageCount} pages using strategy: ${pdfResult.strategy}`
                );
              } else if (
                fileData.mimetype === 'application/msword' ||
                fileData.mimetype ===
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              ) {
                pageCount = estimateWordPageCount(buffer, fileData.mimetype, app.logger);
                const docType = fileData.mimetype === 'application/msword' ? '.doc' : '.docx';
                app.logger.info(
                  { userId, filename: fileData.filename, docType, estimatedPages: pageCount, bufferSize: buffer.length },
                  `Word document (${docType}) page estimation in batch upload`
                );
              }

              // Upload
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
                success: true,
                url,
                filename: fileData.filename,
                size: buffer.length,
                mimeType: fileData.mimetype,
                pageCount,
              });

              app.logger.info(
                { userId, filename: finalFilename, pageCount },
                'Arquivo uploaded'
              );
            } catch (error) {
              const errorMsg = (error as Error).message || '';
              app.logger.error(
                { userId, filename: fileData.filename, error: errorMsg, errorType: error?.constructor?.name },
                'Falha no upload de arquivo individual'
              );

              // Determine specific error code
              let errorCode = 'UPLOAD_ERROR';
              let errorDisplay = 'Erro ao fazer upload';

              if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
                errorCode = 'STORAGE_UNAUTHORIZED';
                errorDisplay = 'Não autorizado para upload';
              } else if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
                errorCode = 'STORAGE_PERMISSION_DENIED';
                errorDisplay = 'Acesso negado';
              }

              failedFiles.push({
                filename: fileData.filename,
                error: errorDisplay,
                code: errorCode,
              });
            }
          })();

          uploadPromises.push(uploadPromise);
        }

        // Wait for all uploads
        await Promise.all(uploadPromises);

        app.logger.info(
          { userId, uploaded: uploadedFiles.length, failed: failedFiles.length },
          'Upload múltiplo concluído'
        );

        clearTimeout(timeoutId);
        return reply.send({
          uploads: uploadedFiles,
          failed: failedFiles,
        } as MultipleUploadResponse);
      } catch (error) {
        app.logger.error({ userId, error: (error as Error).message }, 'Erro geral');
        clearTimeout(timeoutId);
        return reply.status(500).send({
          uploads: uploadedFiles,
          failed: [
            ...failedFiles,
            {
              filename: 'unknown',
              error: 'Erro no servidor',
              code: 'SERVER_ERROR',
            },
          ],
        } as MultipleUploadResponse);
      }
    }
  );
}
