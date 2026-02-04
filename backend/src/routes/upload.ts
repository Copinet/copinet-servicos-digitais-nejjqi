import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';

export function registerUploadRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // POST /api/upload/document - Upload document image
  fastify.post('/api/upload/document', {
    schema: {
      description: 'Upload a document image',
      tags: ['upload'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            filename: { type: 'string' },
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
      app.logger.warn({}, 'No image file provided for upload');
      return reply.status(400).send({ error: 'No image file provided' });
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
      // Check size after buffering
      if (buffer.length > 5 * 1024 * 1024) { // 5MB limit
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

      // Upload to storage
      const uploadedKey = await app.storage.upload(key, buffer);
      app.logger.info({ userId: session.user.id, filename }, 'Document uploaded to storage');

      // Generate signed URL
      const { url } = await app.storage.getSignedUrl(uploadedKey);
      app.logger.info({ userId: session.user.id, filename }, 'Signed URL generated');

      return { url, filename: data.filename };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Document upload failed');
      return reply.status(500).send({ error: 'Failed to upload document' });
    }
  });
}
