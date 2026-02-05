import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

interface CreateOrderBody {
  serviceId: string;
  flow: 'fazemos' | 'sozinho';
  selectedOption: 'pdf' | 'pdf_impressao';
  formData?: Record<string, any>;
  totalPrice: string;
  customerData?: Record<string, any>;
  documentImages?: string[];
  notes?: string;
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
              flow: { type: 'string' },
              selectedOption: { type: 'string' },
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
        flow: schema.orders.flow,
        selectedOption: schema.orders.selectedOption,
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
            flow: { type: 'string' },
            selectedOption: { type: 'string' },
            customerData: { type: 'object' },
            documentImages: { type: 'array' },
            notes: { type: 'string' },
            totalPrice: { type: 'string' },
            pdfUrl: { type: 'string' },
            pdfAvailableUntil: { type: 'string' },
            qrCode: { type: 'string' },
            printStatus: { type: 'string' },
            estimatedReadyTime: { type: 'string' },
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

  // POST /api/orders - Creates order with new flow system
  fastify.post('/api/orders', {
    schema: {
      description: 'Create a new order with flow selection',
      tags: ['orders'],
      body: {
        type: 'object',
        properties: {
          serviceId: { type: 'string' },
          flow: { type: 'string', enum: ['fazemos', 'sozinho'] },
          selectedOption: { type: 'string', enum: ['pdf', 'pdf_impressao'] },
          formData: { type: 'object' },
          customerData: { type: 'object' },
          documentImages: { type: 'array' },
          notes: { type: 'string' },
          totalPrice: { type: 'string' },
        },
        required: ['serviceId', 'flow', 'selectedOption', 'totalPrice'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            status: { type: 'string' },
            flow: { type: 'string' },
            selectedOption: { type: 'string' },
            pdfUrl: { type: 'string' },
            qrCode: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: CreateOrderBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { serviceId, flow, selectedOption, formData, customerData, documentImages, notes, totalPrice } = request.body;
    const userId = session.user.id;
    app.logger.info({ userId, serviceId, flow, selectedOption, totalPrice }, 'Creating order');

    // Calculate PDF expiration (3 days from now)
    const pdfAvailableUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    // Determine initial status based on flow
    let initialStatus = 'pending';
    let initialPrintStatus = null;

    if (flow === 'sozinho') {
      initialStatus = 'processing';
    }

    if (selectedOption === 'pdf_impressao') {
      initialPrintStatus = 'pending';
    }

    // Generate mock QR code and PDF URL (in production, these would be actual generated values)
    const orderId = crypto.randomUUID();
    const mockQrCode = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='white'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em'%3E${orderId.substring(0, 8)}%3C/text%3E%3C/svg%3E`;
    const mockPdfUrl = `https://storage.example.com/orders/${orderId}/document.pdf`;

    const newOrder = await app.db
      .insert(schema.orders)
      .values({
        id: orderId,
        userId,
        serviceId,
        status: initialStatus,
        flow,
        selectedOption,
        formData: formData || null,
        customerData: customerData || null,
        documentImages: documentImages || null,
        notes: notes || null,
        totalPrice,
        pdfUrl: mockPdfUrl,
        pdfAvailableUntil,
        qrCode: mockQrCode,
        printStatus: initialPrintStatus,
      })
      .returning();

    app.logger.info({ orderId: newOrder[0].id, userId, flow, selectedOption }, 'Order created successfully');
    return reply.status(201).send({
      orderId: newOrder[0].id,
      status: newOrder[0].status,
      flow: newOrder[0].flow,
      selectedOption: newOrder[0].selectedOption,
      pdfUrl: newOrder[0].pdfUrl,
      qrCode: newOrder[0].qrCode,
    });
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
