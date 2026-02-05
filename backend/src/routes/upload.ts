import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';

interface FileUploadResponse {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  pageCount: number;
}

// Simple PDF page count extractor (counts /Page or /Pages objects)
function extractPDFPageCount(buffer: Buffer): number {
  try {
    const content = buffer.toString('latin1');
    // This is a simplified approach - counts /Type /Page occurrences
    const pageMatches = content.match(/\/Type\s*\/Page\s*(?!s)/g);
    if (pageMatches) {
      return pageMatches.length;
    }
    // Fallback: try to find /Count in /Pages object
    const countMatch = content.match(/\/Pages\s*<<[^>]*\/Count\s*(\d+)/);
    if (countMatch) {
      return parseInt(countMatch[1], 10);
    }
    return 1; // Default to 1 page if cannot determine
  } catch (error) {
    return 1;
  }
}

// Determine page count based on file type
function getPageCount(mimeType: string, fileSize: number): number {
  if (mimeType === 'application/pdf') {
    // PDF page count will be extracted from the actual PDF content
    return 1; // Will be overridden after reading file
  }
  // Images count as 1 page each
  if (mimeType.startsWith('image/')) {
    return 1;
  }
  // Documents default to 1 page
  return 1;
}

export function registerUploadRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // POST /api/upload/document - Upload single document
  fastify.post('/api/upload/document', {
    schema: {
      description: 'Upload a document (PDF, Word, or image)',
      tags: ['upload'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
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

    app.logger.info({ userId: session.user.id }, 'Starting document upload');

    const data = await request.file();
    if (!data) {
      app.logger.warn({}, 'No file provided for upload');
      return reply.status(400).send({ error: 'No file provided' });
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
      // Check size after buffering
      if (buffer.length > 25 * 1024 * 1024) { // 25MB limit
        app.logger.error({}, 'File size exceeded');
        return reply.status(413).send({ error: 'File too large' });
      }
    } catch (err) {
      app.logger.error({ err }, 'Failed to read upload file');
      return reply.status(400).send({ error: 'Failed to read file' });
    }

    try {
      const timestamp = Date.now();
      const filename = `${timestamp}-${data.filename}`;
      const key = `documents/${session.user.id}/${filename}`;

      // Extract page count for PDFs
      let pageCount = getPageCount(data.mimetype, buffer.length);
      if (data.mimetype === 'application/pdf') {
        pageCount = extractPDFPageCount(buffer);
      }

      // Upload to storage
      const uploadedKey = await app.storage.upload(key, buffer);
      app.logger.info({ userId: session.user.id, filename, pageCount }, 'Document uploaded to storage');

      // Generate signed URL
      const { url } = await app.storage.getSignedUrl(uploadedKey);
      app.logger.info({ userId: session.user.id, filename }, 'Signed URL generated');

      return {
        url,
        filename: data.filename,
        size: buffer.length,
        mimeType: data.mimetype,
        pageCount,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Document upload failed');
      return reply.status(500).send({ error: 'Failed to upload document' });
    }
  });

  // POST /api/upload/multiple - Upload multiple files
  fastify.post('/api/upload/multiple', {
    schema: {
      description: 'Upload multiple documents',
      tags: ['upload'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              filename: { type: 'string' },
              size: { type: 'number' },
              mimeType: { type: 'string' },
              pageCount: { type: 'number' },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Starting multiple file upload');

    const files = await request.files();
    const uploadedFiles: FileUploadResponse[] = [];

    for await (const fileData of files) {
      try {
        let buffer: Buffer;
        try {
          buffer = await fileData.toBuffer();
          // Check size after buffering
          if (buffer.length > 25 * 1024 * 1024) { // 25MB limit per file
            app.logger.warn({ filename: fileData.filename }, 'File size exceeded');
            continue;
          }
        } catch (err) {
          app.logger.error({ err, filename: fileData.filename }, 'Failed to read file');
          continue;
        }

        const timestamp = Date.now();
        const filename = `${timestamp}-${fileData.filename}`;
        const key = `documents/${session.user.id}/${filename}`;

        // Extract page count for PDFs
        let pageCount = getPageCount(fileData.mimetype, buffer.length);
        if (fileData.mimetype === 'application/pdf') {
          pageCount = extractPDFPageCount(buffer);
        }

        // Upload to storage
        const uploadedKey = await app.storage.upload(key, buffer);

        // Generate signed URL
        const { url } = await app.storage.getSignedUrl(uploadedKey);

        uploadedFiles.push({
          url,
          filename: fileData.filename,
          size: buffer.length,
          mimeType: fileData.mimetype,
          pageCount,
        });

        app.logger.info({ userId: session.user.id, filename, pageCount }, 'File uploaded successfully');
      } catch (error) {
        app.logger.error({ err: error, filename: fileData.filename }, 'Failed to upload file');
        continue;
      }
    }

    app.logger.info({ userId: session.user.id, count: uploadedFiles.length }, 'Multiple file upload completed');
    return uploadedFiles;
  });
}
