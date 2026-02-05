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

const AI_TIMEOUT = 30000; // 30 seconds
const FETCH_TIMEOUT = 10000; // 10 seconds

// Helper function to fetch image with timeout
async function fetchImageWithTimeout(imageUrl: string, timeout: number): Promise<Buffer> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Copinet/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeoutId);
  }
}

// Helper function to timeout AI processing
async function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('AI processing timeout')), timeout)
  );
  return Promise.race([promise, timeoutPromise]);
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
            success: { type: 'boolean' },
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
      // Validate URL format
      try {
        new URL(imageUrl);
      } catch (err) {
        app.logger.warn({ userId, imageUrl }, 'Invalid image URL format');
        return reply.status(400).send({
          processedImageUrl: imageUrl,
          success: false,
        });
      }

      // Fetch the image from URL with timeout
      let imageBuffer: Buffer;
      try {
        imageBuffer = await fetchImageWithTimeout(imageUrl, FETCH_TIMEOUT);
      } catch (fetchErr) {
        app.logger.warn({ userId, imageUrl, err: fetchErr }, 'Failed to fetch image');
        // Return original URL as fallback
        return {
          processedImageUrl: imageUrl,
          success: false,
        };
      }

      const base64Image = imageBuffer.toString('base64');

      // Use GPT-5.2 vision to process the image with timeout
      let result;
      try {
        result = await withTimeout(
          generateText({
            model: gateway('openai/gpt-5.2'),
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image', image: base64Image },
                  {
                    type: 'text',
                    text: 'Remove the background from this image and replace it with a white background. Return the processed image as base64 PNG.',
                  },
                ],
              },
            ],
          }),
          AI_TIMEOUT
        );
      } catch (aiErr) {
        app.logger.warn({ userId, err: aiErr }, 'AI background removal failed, using fallback');
        // Return original URL as fallback
        return {
          processedImageUrl: imageUrl,
          success: false,
        };
      }

      app.logger.info({ userId }, 'Background removal completed');

      // Return processed image (could be base64 or URL)
      const processedUrl = result.text.startsWith('data:') || result.text.startsWith('http')
        ? result.text
        : `data:image/png;base64,${result.text}`;

      return { processedImageUrl: processedUrl, success: true };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Background removal endpoint error');
      // Return original URL on any error
      return {
        processedImageUrl: request.body.imageUrl,
        success: false,
      };
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
            success: { type: 'boolean' },
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
      // Validate URL format
      try {
        new URL(imageUrl);
      } catch (err) {
        app.logger.warn({ userId, imageUrl }, 'Invalid image URL format');
        return reply.status(400).send({
          processedImageUrl: imageUrl,
          success: false,
        });
      }

      // Fetch the image from URL with timeout
      let imageBuffer: Buffer;
      try {
        imageBuffer = await fetchImageWithTimeout(imageUrl, FETCH_TIMEOUT);
      } catch (fetchErr) {
        app.logger.warn({ userId, imageUrl, err: fetchErr }, 'Failed to fetch image');
        // Return original URL as fallback
        return {
          processedImageUrl: imageUrl,
          success: false,
        };
      }

      const base64Image = imageBuffer.toString('base64');

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
      instructions += 'Return the enhanced image as base64 PNG.';

      // Use GPT-5.2 vision to process the image with timeout
      let result;
      try {
        result = await withTimeout(
          generateText({
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
          }),
          AI_TIMEOUT
        );
      } catch (aiErr) {
        app.logger.warn({ userId, err: aiErr }, 'AI document enhancement failed, using fallback');
        // Return original URL as fallback
        return {
          processedImageUrl: imageUrl,
          success: false,
        };
      }

      app.logger.info({ userId }, 'Document enhancement completed');

      // Return processed image (could be base64 or URL)
      const processedUrl = result.text.startsWith('data:') || result.text.startsWith('http')
        ? result.text
        : `data:image/png;base64,${result.text}`;

      return { processedImageUrl: processedUrl, success: true };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Document enhancement endpoint error');
      // Return original URL on any error
      return {
        processedImageUrl: request.body.imageUrl,
        success: false,
      };
    }
  });
}
