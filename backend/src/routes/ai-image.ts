import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { gateway } from '@specific-dev/framework';
import { generateText } from 'ai';
import type { App } from '../index.js';

interface RemoveBackgroundBody {
  imageUrl: string;
}

interface EnhanceDocumentBody {
  imageUrl: string;
  options?: {
    autoCrop?: boolean;
    perspectiveCorrection?: boolean;
    enhanceContrast?: boolean;
  };
}

export function registerAIImageRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // POST /api/ai/remove-background - Remove background from image
  fastify.post('/api/ai/remove-background', {
    schema: {
      description: 'Remove background from image using AI',
      tags: ['ai-image'],
      body: {
        type: 'object',
        properties: {
          imageUrl: { type: 'string' },
        },
        required: ['imageUrl'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            processedImageUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: RemoveBackgroundBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { imageUrl } = request.body;
    const userId = session.user.id;
    app.logger.info({ userId, imageUrl }, 'Starting background removal');

    try {
      // Fetch the image from URL
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        app.logger.warn({ imageUrl }, 'Failed to fetch image');
        return reply.status(400).send({ error: 'Failed to fetch image' });
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');

      // Use GPT-5.2 vision to process the image
      const result = await generateText({
        model: gateway('openai/gpt-5.2'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', image: base64Image },
              {
                type: 'text',
                text: 'Remove the background from this image and replace it with a white background. Return a data URL of the processed image in base64 PNG format.',
              },
            ],
          },
        ],
      });

      app.logger.info({ userId }, 'Background removal completed');

      // In a real implementation, you would:
      // 1. Parse the returned image data
      // 2. Upload it to storage
      // 3. Return the signed URL
      // For now, we'll return a mock response
      const mockProcessedUrl = `data:image/png;base64,${Buffer.from(result.text).toString('base64')}`;

      return { processedImageUrl: mockProcessedUrl };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Background removal failed');
      return reply.status(500).send({ error: 'Failed to process image' });
    }
  });

  // POST /api/ai/enhance-document - Enhance scanned document image
  fastify.post('/api/ai/enhance-document', {
    schema: {
      description: 'Enhance scanned document image using AI',
      tags: ['ai-image'],
      body: {
        type: 'object',
        properties: {
          imageUrl: { type: 'string' },
          options: {
            type: 'object',
            properties: {
              autoCrop: { type: 'boolean' },
              perspectiveCorrection: { type: 'boolean' },
              enhanceContrast: { type: 'boolean' },
            },
          },
        },
        required: ['imageUrl'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            processedImageUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: EnhanceDocumentBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { imageUrl, options = {} } = request.body;
    const userId = session.user.id;
    app.logger.info({ userId, imageUrl, options }, 'Starting document enhancement');

    try {
      // Fetch the image from URL
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        app.logger.warn({ imageUrl }, 'Failed to fetch image');
        return reply.status(400).send({ error: 'Failed to fetch image' });
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');

      // Build enhancement instructions
      let instructions = 'Enhance this scanned document image. ';
      if (options.autoCrop) {
        instructions += 'Automatically crop to remove borders and empty space. ';
      }
      if (options.perspectiveCorrection) {
        instructions += 'Apply perspective correction to align the document properly. ';
      }
      if (options.enhanceContrast) {
        instructions += 'Enhance contrast to make text clearer and more readable. ';
      }
      instructions += 'Return a data URL of the enhanced image in base64 PNG format.';

      // Use GPT-5.2 vision to process the image
      const result = await generateText({
        model: gateway('openai/gpt-5.2'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', image: base64Image },
              {
                type: 'text',
                text: instructions,
              },
            ],
          },
        ],
      });

      app.logger.info({ userId }, 'Document enhancement completed');

      // In a real implementation, you would:
      // 1. Parse the returned image data
      // 2. Upload it to storage
      // 3. Return the signed URL
      // For now, we'll return a mock response
      const mockProcessedUrl = `data:image/png;base64,${Buffer.from(result.text).toString('base64')}`;

      return { processedImageUrl: mockProcessedUrl };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Document enhancement failed');
      return reply.status(500).send({ error: 'Failed to enhance document' });
    }
  });
}
