import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { gateway } from '@specific-dev/framework';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import type { App } from '../index.js';

interface ChatBody {
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

// Zod schema for OCR extraction
const ocrResultSchema = z.object({
  name: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  birthDate: z.string().optional(),
  motherName: z.string().optional(),
  fatherName: z.string().optional(),
});

type OCRResult = z.infer<typeof ocrResultSchema>;

export function registerAIRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // POST /api/ocr/extract - Extracts data from ID documents using GPT vision
  fastify.post('/api/ocr/extract', {
    schema: {
      description: 'Extract data from ID documents (RG, CNH) using OCR',
      tags: ['ocr'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            cpf: { type: 'string' },
            rg: { type: 'string' },
            birthDate: { type: 'string' },
            motherName: { type: 'string' },
            fatherName: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Starting OCR document extraction');

    const data = await request.file();
    if (!data) {
      app.logger.warn({}, 'No image file provided for OCR');
      return reply.status(400).send({ error: 'No image file provided' });
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
      // Check size after buffering
      if (buffer.length > 10 * 1024 * 1024) { // 10MB limit
        app.logger.error({}, 'File size exceeded for OCR');
        return reply.status(413).send({ error: 'File too large' });
      }
    } catch (err) {
      app.logger.error({ err }, 'Failed to read OCR file');
      return reply.status(400).send({ error: 'Failed to read file' });
    }

    try {
      const base64 = buffer.toString('base64');

      const result = await generateObject({
        model: gateway('openai/gpt-5.2'),
        schema: ocrResultSchema,
        schemaName: 'DocumentData',
        schemaDescription: 'Extract information from Brazilian identity documents (RG, CNH)',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', image: base64 },
              {
                type: 'text',
                text: 'Extract the following information from this Brazilian ID document (RG or CNH): name, CPF (Cadastro de Pessoa Física), RG (Registro Geral), birth date, mother\'s full name (filiation), and father\'s full name (filiation). Return only the extracted data in Portuguese.',
              },
            ],
          },
        ],
      });

      app.logger.info({ userId: session.user.id, extracted: Object.keys(result.object) }, 'OCR extraction completed successfully');
      return result.object;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'OCR extraction failed');
      return reply.status(500).send({ error: 'Failed to extract document data' });
    }
  });

  // POST /api/voice/transcribe - Transcribes audio using GPT-5.2
  fastify.post('/api/voice/transcribe', {
    schema: {
      description: 'Transcribe audio to text',
      tags: ['voice'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Starting audio transcription');

    const data = await request.file();
    if (!data) {
      app.logger.warn({}, 'No audio file provided for transcription');
      return reply.status(400).send({ error: 'No audio file provided' });
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
      // Check size after buffering
      if (buffer.length > 25 * 1024 * 1024) { // 25MB limit
        app.logger.error({}, 'Audio file size exceeded');
        return reply.status(413).send({ error: 'File too large' });
      }
    } catch (err) {
      app.logger.error({ err }, 'Failed to read audio file');
      return reply.status(400).send({ error: 'Failed to read file' });
    }

    try {
      const base64 = buffer.toString('base64');

      // Use generateText with file content as base64
      const result = await generateText({
        model: gateway('openai/gpt-5.2'),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Transcribe this audio file (base64 encoded ${data.mimetype}). Return only the transcribed text in Portuguese: ${base64}`,
              },
            ],
          },
        ],
      });

      app.logger.info({ userId: session.user.id }, 'Audio transcription completed successfully');
      return { text: result.text };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Audio transcription failed');
      return reply.status(500).send({ error: 'Failed to transcribe audio' });
    }
  });

  // POST /api/support/chat - AI-powered customer support
  fastify.post('/api/support/chat', {
    schema: {
      description: 'Chat with AI customer support',
      tags: ['support'],
      body: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          conversationHistory: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string' },
                content: { type: 'string' },
              },
            },
          },
        },
        required: ['message'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            response: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: ChatBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { message, conversationHistory = [] } = request.body;
    app.logger.info({ userId: session.user.id }, 'Starting chat support');

    try {
      // Prepare messages for the AI
      const messages = [
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        {
          role: 'user' as const,
          content: message,
        },
      ];

      const result = await generateText({
        model: gateway('openai/gpt-5.2'),
        system: 'You are a helpful customer support assistant for Copinet Serviços Digitais, a digital services company offering document, printing, and graphics services in Portuguese. Be professional, helpful, and answer questions about our services. Always respond in Portuguese.',
        messages,
      });

      app.logger.info({ userId: session.user.id }, 'Chat support response generated');
      return { response: result.text };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Chat support failed');
      return reply.status(500).send({ error: 'Failed to generate support response' });
    }
  });
}
