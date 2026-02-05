import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerPricingRoutes(app: App, fastify: FastifyInstance) {
  // GET /api/pricing - Returns pricing configuration for all service types
  fastify.get('/api/pricing', {
    schema: {
      description: 'Get pricing configuration for all service types',
      tags: ['pricing'],
      response: {
        200: {
          type: 'object',
          properties: {
            quick_print: { type: 'object' },
            photo_print: { type: 'object' },
            photo_3x4: { type: 'object' },
            scan_to_pdf: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({}, 'Fetching pricing configuration');

    const pricingConfigs = await app.db.query.pricingConfig.findMany();

    const pricingResponse: Record<string, Record<string, any>> = {};

    for (const config of pricingConfigs) {
      const serviceType = config.serviceType as string;

      if (serviceType === 'photo_print') {
        pricingResponse[serviceType] = {
          sizes: (config.photoSizes as Record<string, number>) || {},
        };
      } else if (serviceType === 'photo_3x4') {
        pricingResponse[serviceType] = {
          price: parseFloat((config.pricePerPage as string) || '0'),
        };
      } else {
        pricingResponse[serviceType] = {
          pricePerPage: parseFloat((config.pricePerPage as string) || '0'),
        };
      }
    }

    app.logger.info({}, 'Pricing configuration fetched successfully');
    return pricingResponse;
  });
}
