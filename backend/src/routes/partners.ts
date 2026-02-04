import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

interface RegisterPartnerBody {
  businessName: string;
  address: string;
  latitude: string;
  longitude: string;
  phone: string;
  servicesOffered?: string[];
}

export function registerPartnersRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // GET /api/partners - Returns all approved partners
  fastify.get('/api/partners', {
    schema: {
      description: 'Get all approved partners',
      tags: ['partners'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              businessName: { type: 'string' },
              address: { type: 'string' },
              latitude: { type: 'string' },
              longitude: { type: 'string' },
              phone: { type: 'string' },
              servicesOffered: { type: 'array' },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({}, 'Fetching approved partners');

    const approvedPartners = await app.db
      .select({
        id: schema.partners.id,
        businessName: schema.partners.businessName,
        address: schema.partners.address,
        latitude: schema.partners.latitude,
        longitude: schema.partners.longitude,
        phone: schema.partners.phone,
        servicesOffered: schema.partners.servicesOffered,
      })
      .from(schema.partners)
      .where(eq(schema.partners.isApproved, true));

    app.logger.info({ count: approvedPartners.length }, 'Approved partners fetched');
    return approvedPartners;
  });

  // POST /api/partners/register - Register new partner
  fastify.post('/api/partners/register', {
    schema: {
      description: 'Register as a partner (pending approval)',
      tags: ['partners'],
      body: {
        type: 'object',
        properties: {
          businessName: { type: 'string' },
          address: { type: 'string' },
          latitude: { type: 'string' },
          longitude: { type: 'string' },
          phone: { type: 'string' },
          servicesOffered: { type: 'array' },
        },
        required: ['businessName', 'address', 'latitude', 'longitude', 'phone'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            businessName: { type: 'string' },
            address: { type: 'string' },
            latitude: { type: 'string' },
            longitude: { type: 'string' },
            phone: { type: 'string' },
            servicesOffered: { type: 'array' },
            isApproved: { type: 'boolean' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: RegisterPartnerBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { businessName, address, latitude, longitude, phone, servicesOffered } = request.body;
    const userId = session.user.id;

    app.logger.info({ userId, businessName }, 'Registering new partner');

    const newPartner = await app.db
      .insert(schema.partners)
      .values({
        userId,
        businessName,
        address,
        latitude,
        longitude,
        phone,
        servicesOffered: servicesOffered || null,
        isApproved: false,
      })
      .returning();

    app.logger.info({ partnerId: newPartner[0].id, userId }, 'Partner registered successfully');
    return reply.status(201).send(newPartner[0]);
  });
}
