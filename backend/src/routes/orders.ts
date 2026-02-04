import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

interface CreateOrderBody {
  serviceId: string;
  customerData?: Record<string, any>;
  documentImages?: string[];
  notes?: string;
  totalPrice: string;
}

interface UpdateOrderBody {
  status?: string;
  notes?: string;
}

export function registerOrdersRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // GET /api/orders - Returns user's orders
  fastify.get('/api/orders', {
    schema: {
      description: 'Get all orders for authenticated user',
      tags: ['orders'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              serviceId: { type: 'string' },
              serviceName: { type: 'string' },
              status: { type: 'string' },
              customerData: { type: 'object' },
              totalPrice: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching user orders');

    const userOrders = await app.db
      .select({
        id: schema.orders.id,
        serviceId: schema.orders.serviceId,
        serviceName: schema.services.name,
        status: schema.orders.status,
        customerData: schema.orders.customerData,
        totalPrice: schema.orders.totalPrice,
        createdAt: schema.orders.createdAt,
        updatedAt: schema.orders.updatedAt,
      })
      .from(schema.orders)
      .leftJoin(schema.services, eq(schema.orders.serviceId, schema.services.id))
      .where(eq(schema.orders.userId, userId));

    app.logger.info({ userId, count: userOrders.length }, 'Orders fetched successfully');
    return userOrders;
  });

  // GET /api/orders/:id - Returns single order details (only if user owns it)
  fastify.get('/api/orders/:id', {
    schema: {
      description: 'Get order details by ID (must be order owner)',
      tags: ['orders'],
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
            serviceId: { type: 'string' },
            serviceName: { type: 'string' },
            status: { type: 'string' },
            customerData: { type: 'object' },
            documentImages: { type: 'array' },
            notes: { type: 'string' },
            totalPrice: { type: 'string' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const userId = session.user.id;
    app.logger.info({ orderId: id, userId }, 'Fetching order details');

    const order = await app.db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
    });

    if (!order) {
      app.logger.warn({ orderId: id }, 'Order not found');
      return reply.status(404).send({ error: 'Order not found' });
    }

    if (order.userId !== userId) {
      app.logger.warn({ orderId: id, userId, orderUserId: order.userId }, 'Unauthorized access to order');
      return reply.status(403).send({ error: 'Unauthorized' });
    }

    const service = await app.db.query.services.findFirst({
      where: eq(schema.services.id, order.serviceId),
    });

    app.logger.info({ orderId: id }, 'Order details fetched successfully');
    return {
      ...order,
      serviceName: service?.name || 'Unknown Service',
    };
  });

  // POST /api/orders - Creates order with authenticated user
  fastify.post('/api/orders', {
    schema: {
      description: 'Create a new order',
      tags: ['orders'],
      body: {
        type: 'object',
        properties: {
          serviceId: { type: 'string' },
          customerData: { type: 'object' },
          documentImages: { type: 'array' },
          notes: { type: 'string' },
          totalPrice: { type: 'string' },
        },
        required: ['serviceId', 'totalPrice'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            serviceId: { type: 'string' },
            status: { type: 'string' },
            customerData: { type: 'object' },
            documentImages: { type: 'array' },
            notes: { type: 'string' },
            totalPrice: { type: 'string' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: CreateOrderBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { serviceId, customerData, documentImages, notes, totalPrice } = request.body;
    const userId = session.user.id;
    app.logger.info({ userId, serviceId, totalPrice }, 'Creating order');

    const newOrder = await app.db
      .insert(schema.orders)
      .values({
        userId,
        serviceId,
        status: 'pending',
        customerData: customerData || null,
        documentImages: documentImages || null,
        notes: notes || null,
        totalPrice,
      })
      .returning();

    app.logger.info({ orderId: newOrder[0].id, userId }, 'Order created successfully');
    return reply.status(201).send(newOrder[0]);
  });

  // PUT /api/orders/:id - Updates order (only if user owns it)
  fastify.put('/api/orders/:id', {
    schema: {
      description: 'Update order details (must be order owner)',
      tags: ['orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          notes: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            notes: { type: 'string' },
            updatedAt: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateOrderBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const { status, notes } = request.body;
    const userId = session.user.id;
    app.logger.info({ orderId: id, userId, status }, 'Updating order');

    const order = await app.db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
    });

    if (!order) {
      app.logger.warn({ orderId: id }, 'Order not found');
      return reply.status(404).send({ error: 'Order not found' });
    }

    if (order.userId !== userId) {
      app.logger.warn({ orderId: id, userId }, 'Unauthorized update attempt');
      return reply.status(403).send({ error: 'Unauthorized' });
    }

    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const updatedOrder = await app.db
      .update(schema.orders)
      .set(updateData)
      .where(eq(schema.orders.id, id))
      .returning();

    app.logger.info({ orderId: id }, 'Order updated successfully');
    return updatedOrder[0];
  });

  // DELETE /api/orders/:id - Cancels order (only if user owns it)
  fastify.delete('/api/orders/:id', {
    schema: {
      description: 'Cancel an order (must be order owner)',
      tags: ['orders'],
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
            message: { type: 'string' },
            orderId: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const userId = session.user.id;
    app.logger.info({ orderId: id, userId }, 'Cancelling order');

    const order = await app.db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
    });

    if (!order) {
      app.logger.warn({ orderId: id }, 'Order not found');
      return reply.status(404).send({ error: 'Order not found' });
    }

    if (order.userId !== userId) {
      app.logger.warn({ orderId: id, userId }, 'Unauthorized deletion attempt');
      return reply.status(403).send({ error: 'Unauthorized' });
    }

    await app.db
      .update(schema.orders)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(schema.orders.id, id));

    app.logger.info({ orderId: id }, 'Order cancelled successfully');
    return { message: 'Order cancelled successfully', orderId: id };
  });
}
