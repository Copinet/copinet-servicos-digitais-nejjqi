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

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PDF_PAGES = 1500;
const MAX_FILENAME_LENGTH = 200;
const UPLOAD_TIMEOUT = 5 * 60 * 1000; // 5 minutes
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

// Extract PDF page count - Robust parsing with multiple strategies
function extractPDFPageCount(buffer: Buffer): number {
  try {
    // Convert to string using latin1 encoding (preserves binary data as-is)
    const content = buffer.toString('latin1');
    let detectedPages = 0;

    // Strategy 1: Find Catalog /Pages object and get /Count (MOST RELIABLE)
    // PDFs have a Catalog object that points to the Pages tree root
    // The root Pages object contains /Count with total page count
    const catalogMatch = content.match(/\/Type\s*\/Catalog[\s\S]*?\/Pages\s+(\d+)\s+0\s+R/);
    if (catalogMatch) {
      const pageTreeObjNum = parseInt(catalogMatch[1], 10);
      // Find the Pages object and extract its /Count
      const pageTreeRegex = new RegExp(
        pageTreeObjNum + '\\s+0\\s+obj[\\s\\S]*?/Type\\s*/Pages[\\s\\S]*?/Count\\s+(\\d+)',
        'i'
      );
      const pageTreeMatch = content.match(pageTreeRegex);
      if (pageTreeMatch) {
        detectedPages = parseInt(pageTreeMatch[1], 10);
        if (detectedPages > 0) {
          return Math.min(detectedPages, MAX_PDF_PAGES);
        }
      }
    }

    // Strategy 2: Find /Pages object directly with /Count (handles simpler PDFs)
    // Some PDFs have inline /Pages with /Count instead of indirect reference
    const directPagesMatch = content.match(/\/Type\s*\/Pages[\s\S]{0,500}?\/Count\s+(\d+)/i);
    if (directPagesMatch) {
      detectedPages = parseInt(directPagesMatch[1], 10);
      if (detectedPages > 0) {
        return Math.min(detectedPages, MAX_PDF_PAGES);
      }
    }

    // Strategy 3: Count all /Type /Page objects (actual page dictionaries)
    // Each page in PDF is an object with /Type /Page
    // This method counts actual page objects, more reliable than Kids arrays for some PDFs
    const pageObjMatches = content.match(/\/Type\s*\/Page(?!s)\s*[\n\r\s]/gi);
    if (pageObjMatches && pageObjMatches.length > 0) {
      detectedPages = pageObjMatches.length;
      if (detectedPages > 0) {
        return Math.min(detectedPages, MAX_PDF_PAGES);
      }
    }

    // Strategy 4: Count /Kids array references in page tree
    // The /Kids array in /Pages objects contains references to all pages
    // Look for all /Kids arrays and count the indirect references (n 0 R)
    const kidsMatches = content.match(/\/Kids\s*\[\s*([^\]]+)\s*\]/gi);
    if (kidsMatches) {
      let totalKidsRefs = 0;
      for (const kidsArray of kidsMatches) {
        // Extract all indirect object references (n 0 R format)
        const refMatches = kidsArray.match(/(\d+)\s+0\s+R/g);
        if (refMatches) {
          totalKidsRefs += refMatches.length;
        }
      }
      if (totalKidsRefs > 0) {
        return Math.min(totalKidsRefs, MAX_PDF_PAGES);
      }
    }

    // Strategy 5: Look for /Pages references and count all pages they reference
    // Some PDFs have multiple /Pages objects in a tree structure
    // Find all /Pages objects and sum their /Count values
    const allPagesMatches = content.match(/\/Type\s*\/Pages[\s\S]{0,1000}?\/Count\s+(\d+)/gi);
    if (allPagesMatches) {
      let totalPages = 0;
      for (const pageMatch of allPagesMatches) {
        const countMatch = pageMatch.match(/\/Count\s+(\d+)/i);
        if (countMatch) {
          totalPages += parseInt(countMatch[1], 10);
        }
      }
      if (totalPages > 0) {
        // Return the maximum (root usually has full count, this validates)
        return Math.min(totalPages, MAX_PDF_PAGES);
      }
    }

    // Strategy 6: Last resort - look for stream count patterns
    // Some PDFs encode page information in stream objects
    const streamMatches = content.match(/stream[\s\S]*?endstream/g);
    if (streamMatches && streamMatches.length > 10) {
      // If we have many streams, estimate roughly (streams ~2 per page)
      const estimatedPages = Math.ceil(streamMatches.length / 2.5);
      if (estimatedPages > 0) {
        return Math.min(estimatedPages, MAX_PDF_PAGES);
      }
    }

    // Strategy 7: File size estimation only as last resort
    // Average PDF: 3-5KB per page when compressed
    if (buffer.length > 5000) {
      const estimatedPages = Math.ceil(buffer.length / 4000);
      if (estimatedPages > 0) {
        return Math.min(estimatedPages, MAX_PDF_PAGES);
      }
    }

    // Fallback: assume 1 page if nothing else works
    return 1;
  } catch (error) {
    // On any error, return 1 page minimum
    return 1;
  }
}

// Estimate page count for Word documents
function estimateWordPageCount(buffer: Buffer, mimeType: string): number {
  try {
    // For .docx files, try to extract actual content
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // .docx is a ZIP file, try to find document.xml
      const docXmlStart = buffer.indexOf(Buffer.from('<?xml'));
      if (docXmlStart !== -1) {
        // Found XML content
        const contentLength = buffer.length - docXmlStart;
        // Estimate: ~3000-4000 characters per page in Word docs
        // Being conservative with 3500 chars/page
        const estimatedPages = Math.max(1, Math.ceil(contentLength / 3500));
        return Math.min(estimatedPages, MAX_PDF_PAGES);
      }
    }

    // Fallback for .doc or if XML not found in .docx
    // .doc files: estimate ~20KB per page (with formatting)
    // More conservative than 50KB which was causing huge underestimation
    const estimatedPages = Math.max(1, Math.ceil(buffer.length / 20000));
    return Math.min(estimatedPages, MAX_PDF_PAGES);
  } catch (error) {
    // On error, use conservative file size estimate
    const estimatedPages = Math.max(1, Math.ceil(buffer.length / 20000));
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
              error: `Arquivo muito grande (${(totalSize / 1024 / 1024).toFixed(1)}MB). Máximo permitido: 50MB. Por favor, reduza o tamanho do arquivo ou envie em partes.`,
              code: 'FILE_TOO_LARGE',
            } as ErrorResponse);
          }

          chunks.push(chunk);
        }

        const buffer = Buffer.concat(chunks);
        app.logger.info(
          { userId, size: buffer.length, chunks: chunks.length },
          'Buffer criado'
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
          pageCount = extractPDFPageCount(buffer);
          app.logger.info(
            {
              userId,
              filename: finalFilename,
              detectedPages: pageCount,
              bufferSize: buffer.length,
              fileSizeMB: (buffer.length / 1024 / 1024).toFixed(2)
            },
            `PDF page count detection completed: ${pageCount} pages detected`
          );
        } else if (
          data.mimetype === 'application/msword' ||
          data.mimetype ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) {
          pageCount = estimateWordPageCount(buffer, data.mimetype);
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

        app.logger.info(
          { userId, filename: finalFilename, pageCount },
          'Upload concluído'
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
                    error: `Arquivo muito grande (${(totalSize / 1024 / 1024).toFixed(1)}MB). Máximo: 50MB`,
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
                pageCount = extractPDFPageCount(buffer);
                app.logger.info(
                  {
                    userId,
                    filename: fileData.filename,
                    detectedPages: pageCount,
                    bufferSize: buffer.length,
                    fileSizeMB: (buffer.length / 1024 / 1024).toFixed(2)
                  },
                  `PDF page count detected in batch upload: ${pageCount} pages`
                );
              } else if (
                fileData.mimetype === 'application/msword' ||
                fileData.mimetype ===
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              ) {
                pageCount = estimateWordPageCount(buffer, fileData.mimetype);
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
