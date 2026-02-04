import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerStoresRoutes(app: App, fastify: FastifyInstance) {
  // GET /api/stores - Returns all stores (owned + approved partners)
  fastify.get('/api/stores', {
    schema: {
      description: 'Get all available stores (Copinet owned + approved partners)',
      tags: ['stores'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              address: { type: 'string' },
              latitude: { type: 'string' },
              longitude: { type: 'string' },
              phone: { type: 'string' },
              isOwned: { type: 'boolean' },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({}, 'Fetching all available stores');

    // Get Copinet owned stores
    const ownedStores = await app.db
      .select({
        id: schema.stores.id,
        name: schema.stores.name,
        address: schema.stores.address,
        latitude: schema.stores.latitude,
        longitude: schema.stores.longitude,
        phone: schema.stores.phone,
        isOwned: schema.stores.isOwned,
      })
      .from(schema.stores);

    // Get approved partner stores
    const partnerStores = await app.db
      .select({
        id: schema.partners.id,
        name: schema.partners.businessName,
        address: schema.partners.address,
        latitude: schema.partners.latitude,
        longitude: schema.partners.longitude,
        phone: schema.partners.phone,
        isOwned: schema.partners.isApproved, // Partners are not owned by Copinet
      })
      .from(schema.partners)
      .where(eq(schema.partners.isApproved, true));

    // Map partner data to match store format
    const mappedPartnerStores = partnerStores.map(partner => ({
      ...partner,
      isOwned: false, // Partners are not owned by Copinet
    }));

    const allStores = [...ownedStores, ...mappedPartnerStores];
    app.logger.info({ total: allStores.length, owned: ownedStores.length, partners: mappedPartnerStores.length }, 'Stores fetched successfully');

    return allStores;
  });
}
