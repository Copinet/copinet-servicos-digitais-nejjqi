import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

interface CreateServiceBody {
  name: string;
  description: string;
  category: string;
  price: string;
  estimatedTime?: string;
  icon?: string;
}

export function registerServicesRoutes(app: App, fastify: FastifyInstance) {
  // GET /api/services - Returns all available services
  fastify.get('/api/services', {
    schema: {
      description: 'Get all available services',
      tags: ['services'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              category: { type: 'string' },
              price: { type: 'string' },
              estimatedTime: { type: 'string' },
              icon: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({}, 'Fetching all services');
    const allServices = await app.db.select().from(schema.services);
    app.logger.info({ count: allServices.length }, 'Services fetched successfully');
    return allServices;
  });

  // GET /api/services/:id - Returns single service details
  fastify.get('/api/services/:id', {
    schema: {
      description: 'Get a single service by ID',
      tags: ['services'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            price: { type: 'string' },
            estimatedTime: { type: 'string' },
            icon: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    app.logger.info({ serviceId: id }, 'Fetching service details');

    const service = await app.db.query.services.findFirst({
      where: eq(schema.services.id, id),
    });

    if (!service) {
      app.logger.warn({ serviceId: id }, 'Service not found');
      return reply.status(404).send({ error: 'Service not found' });
    }

    app.logger.info({ serviceId: id }, 'Service fetched successfully');
    return service;
  });

  // POST /api/services - Creates new service (Admin only)
  fastify.post('/api/services', {
    schema: {
      description: 'Create a new service (Admin only)',
      tags: ['services'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          price: { type: 'string' },
          estimatedTime: { type: 'string' },
          icon: { type: 'string' },
        },
        required: ['name', 'description', 'category', 'price'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            price: { type: 'string' },
            estimatedTime: { type: 'string' },
            icon: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: CreateServiceBody }>, reply: FastifyReply) => {
    const { name, description, category, price, estimatedTime, icon } = request.body;
    app.logger.info({ name, category, price }, 'Creating new service');

    const newService = await app.db
      .insert(schema.services)
      .values({
        name,
        description,
        category,
        price,
        estimatedTime: estimatedTime || null,
        icon: icon || null,
      })
      .returning();

    app.logger.info({ serviceId: newService[0].id }, 'Service created successfully');
    return reply.status(201).send(newService[0]);
  });
}
