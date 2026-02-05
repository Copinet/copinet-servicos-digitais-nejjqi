import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

interface CreateQuickPrintBody {
  fileUrl: string;
  filename: string;
  pageCount: number;
  options?: {
    colorMode?: 'bw' | 'color';
    copies?: number;
    paperType?: string;
    paperSize?: string;
  };
}

interface NearbyStore {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  distance: number; // in km
  isOwned: boolean;
  acceptanceTime?: number; // average time in minutes
}

interface QuickPrintOrder {
  id: string;
  userId: string;
  fileUrl: string;
  filename: string;
  pageCount: number;
  options: Record<string, any>;
  totalPrice: number;
  status: 'pending_payment' | 'payment_received' | 'pending_partner' | 'partner_accepted' | 'printing' | 'ready' | 'completed' | 'cancelled';
  partnerId?: string;
  partnerName?: string;
  partnerAddress?: string;
  qrCode?: string;
  pixKey?: string;
  pixQrCode?: string;
  estimatedReadyTime?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Generate mock PIX QR Code (in production, use a PIX library)
function generatePixQrCode(orderId: string, amount: number): string {
  // Mock PIX QR Code (base64)
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='white'/%3E%3Ctext x='50' y='100' font-size='12'%3EPix: ${orderId.substring(0, 8)}%3C/text%3E%3Ctext x='50' y='120' font-size='12'%3ER$ ${amount.toFixed(2)}%3C/text%3E%3C/svg%3E`;
}

export function registerQuickPrintRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // GET /api/quick-print/nearby - Get nearby stores/partners for pickup
  fastify.get<{ Querystring: { latitude: string; longitude: string } }>(
    '/api/quick-print/nearby',
    {
      schema: {
        description: 'Get nearby stores and approved partners for quick print',
        tags: ['quick-print'],
        querystring: {
          type: 'object',
          properties: {
            latitude: { type: 'string' },
            longitude: { type: 'string' },
          },
          required: ['latitude', 'longitude'],
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { latitude: string; longitude: string } }>, reply: FastifyReply) => {
      const { latitude, longitude } = request.query;

      try {
        const clientLat = parseFloat(latitude);
        const clientLon = parseFloat(longitude);

        if (isNaN(clientLat) || isNaN(clientLon)) {
          return reply.status(400).send({
            success: false,
            error: 'Latitude e longitude inválidas',
            code: 'INVALID_COORDS',
          });
        }

        // Get owned stores
        const stores = await app.db.query.stores.findMany();

        // Get approved partners
        const partners = await app.db.query.partners.findMany({
          where: eq(schema.partners.isApproved, true),
        });

        // Calculate distances and filter nearby
        const nearbyStores: NearbyStore[] = [];

        // Add owned stores
        for (const store of stores) {
          const storeLat = typeof store.latitude === 'string' ? parseFloat(store.latitude) : Number(store.latitude);
          const storeLon = typeof store.longitude === 'string' ? parseFloat(store.longitude) : Number(store.longitude);

          const distance = calculateDistance(
            clientLat,
            clientLon,
            storeLat,
            storeLon
          );

          if (distance <= 15) {
            // Within 15 km
            nearbyStores.push({
              id: store.id as string,
              name: store.name as string,
              address: store.address as string,
              latitude: storeLat,
              longitude: storeLon,
              phone: store.phone as string,
              distance: Math.round(distance * 10) / 10,
              isOwned: true,
              acceptanceTime: 2, // Average 2 minutes for owned stores
            });
          }
        }

        // Add approved partners
        for (const partner of partners) {
          const partnerLat = typeof partner.latitude === 'string' ? parseFloat(partner.latitude) : Number(partner.latitude);
          const partnerLon = typeof partner.longitude === 'string' ? parseFloat(partner.longitude) : Number(partner.longitude);

          const distance = calculateDistance(
            clientLat,
            clientLon,
            partnerLat,
            partnerLon
          );

          if (distance <= 15) {
            // Within 15 km
            nearbyStores.push({
              id: partner.id,
              name: partner.businessName,
              address: partner.address,
              latitude: partnerLat,
              longitude: partnerLon,
              phone: partner.phone,
              distance: Math.round(distance * 10) / 10,
              isOwned: false,
              acceptanceTime: 5, // Average 5 minutes for partners
            });
          }
        }

        // Sort by distance
        nearbyStores.sort((a, b) => a.distance - b.distance);

        app.logger.info(
          { clientLat, clientLon, found: nearbyStores.length },
          'Nearby stores fetched'
        );

        return {
          success: true,
          stores: nearbyStores,
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Error fetching nearby stores');
        return reply.status(500).send({
          success: false,
          error: 'Erro ao buscar lojas próximas',
          code: 'SERVER_ERROR',
        });
      }
    }
  );

  // POST /api/quick-print/create - Create quick print order
  fastify.post<{ Body: CreateQuickPrintBody }>(
    '/api/quick-print/create',
    {
      schema: {
        description: 'Create a quick print order',
        tags: ['quick-print'],
        body: {
          type: 'object',
          properties: {
            fileUrl: { type: 'string' },
            filename: { type: 'string' },
            pageCount: { type: 'number' },
            options: { type: 'object' },
          },
          required: ['fileUrl', 'filename', 'pageCount'],
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateQuickPrintBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { fileUrl, filename, pageCount, options = {} } = request.body;

      try {
        // Calculate price: R$ 0.50 per page (BW) or R$ 1.00 per page (color)
        const colorMode = options.colorMode || 'bw';
        const pricePerPage = colorMode === 'color' ? 1.0 : 0.5;
        const copies = options.copies || 1;
        const totalPrice = pageCount * pricePerPage * copies;

        // Create order in database
        const order = await app.db
          .insert(schema.printJobs)
          .values({
            userId,
            serviceType: 'quick_print',
            files: [{ url: fileUrl, name: filename, pageCount }] as any,
            options: options as any,
            totalPages: String(pageCount * copies),
            pricePerPage: String(pricePerPage),
            totalPrice: String(totalPrice),
            status: 'pending',
          })
          .returning();

        app.logger.info(
          { userId, orderId: order[0].id, pageCount, totalPrice },
          'Quick print order created'
        );

        return reply.status(201).send({
          success: true,
          orderId: order[0].id,
          totalPrice,
          message: 'Pedido criado. Agora escolha uma loja para retirar.',
        });
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Error creating quick print order');
        return reply.status(500).send({
          success: false,
          error: 'Erro ao criar pedido',
          code: 'ORDER_ERROR',
        });
      }
    }
  );

  // POST /api/quick-print/:orderId/select-partner - Select partner/store for pickup
  fastify.post<{ Params: { orderId: string }; Body: { storeId: string } }>(
    '/api/quick-print/:orderId/select-partner',
    {
      schema: {
        description: 'Select a partner/store for quick print order',
        tags: ['quick-print'],
        params: {
          type: 'object',
          properties: { orderId: { type: 'string' } },
          required: ['orderId'],
        },
      },
    },
    async (request: FastifyRequest<{ Params: { orderId: string }; Body: { storeId: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { orderId } = request.params;
      const { storeId } = request.body;
      const userId = session.user.id;

      try {
        // Verify order exists and belongs to user
        const order = await app.db.query.printJobs.findFirst({
          where: eq(schema.printJobs.id, orderId),
        });

        if (!order || order.userId !== userId) {
          return reply.status(404).send({
            success: false,
            error: 'Pedido não encontrado',
            code: 'NOT_FOUND',
          });
        }

        // Get selected store/partner
        let selectedStore = await app.db.query.stores.findFirst({
          where: eq(schema.stores.id, storeId),
        });

        let partnerName = selectedStore?.name;
        let partnerAddress = selectedStore?.address;

        if (!selectedStore) {
          // Try to find as partner
          const partner = await app.db.query.partners.findFirst({
            where: eq(schema.partners.id, storeId),
          });

          if (!partner) {
            return reply.status(404).send({
              success: false,
              error: 'Loja não encontrada',
              code: 'STORE_NOT_FOUND',
            });
          }

          partnerName = partner.businessName;
          partnerAddress = partner.address;
        }

        // Generate QR code and PIX
        const totalPrice = parseFloat(order.totalPrice.toString());
        const pixQrCode = generatePixQrCode(orderId, totalPrice);
        const pixKey = `copinet.${orderId.substring(0, 8)}`;

        // Update order with partner info and store in options
        const existingOptions = (order.options || {}) as Record<string, any>;
        const updatedOrder = await app.db
          .update(schema.printJobs)
          .set({
            options: {
              ...existingOptions,
              selectedStoreId: storeId,
              pixKey,
              pixQrCode,
              storeInfo: { name: partnerName, address: partnerAddress }
            } as any,
            pdfUrl: pixQrCode,
            status: 'pending',
            updatedAt: new Date(),
          })
          .where(eq(schema.printJobs.id, orderId))
          .returning();

        app.logger.info(
          { userId, orderId, storeId },
          'Partner selected for quick print'
        );

        return {
          success: true,
          orderId,
          partnerName,
          partnerAddress,
          totalPrice,
          pixKey,
          pixQrCode,
          message: 'Loja selecionada. Agora faça o pagamento via PIX.',
        };
      } catch (error) {
        app.logger.error({ err: error, userId, orderId }, 'Error selecting partner');
        return reply.status(500).send({
          success: false,
          error: 'Erro ao selecionar loja',
          code: 'SERVER_ERROR',
        });
      }
    }
  );

  // POST /api/quick-print/:orderId/confirm-payment - Confirm payment and notify partner
  fastify.post<{ Params: { orderId: string } }>(
    '/api/quick-print/:orderId/confirm-payment',
    {
      schema: {
        description: 'Confirm PIX payment and send to partner',
        tags: ['quick-print'],
        params: {
          type: 'object',
          properties: { orderId: { type: 'string' } },
          required: ['orderId'],
        },
      },
    },
    async (request: FastifyRequest<{ Params: { orderId: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { orderId } = request.params;
      const userId = session.user.id;

      try {
        const order = await app.db.query.printJobs.findFirst({
          where: eq(schema.printJobs.id, orderId),
        });

        if (!order || order.userId !== userId) {
          return reply.status(404).send({
            success: false,
            error: 'Pedido não encontrado',
            code: 'NOT_FOUND',
          });
        }

        // Update order status to payment received
        await app.db
          .update(schema.printJobs)
          .set({
            status: 'pending',
            updatedAt: new Date(),
          })
          .where(eq(schema.printJobs.id, orderId));

        app.logger.info(
          { userId, orderId },
          'Payment confirmed, notifying partner'
        );

        // In production: send WebSocket notification to partner
        // For now, just confirm to client
        return {
          success: true,
          orderId,
          status: 'payment_confirmed',
          message: 'Pagamento recebido! Aguardando confirmação da loja...',
          estimatedWait: '5-10 minutos',
        };
      } catch (error) {
        app.logger.error({ err: error, userId, orderId }, 'Error confirming payment');
        return reply.status(500).send({
          success: false,
          error: 'Erro ao confirmar pagamento',
          code: 'SERVER_ERROR',
        });
      }
    }
  );

  // GET /api/quick-print/:orderId/status - Get order status
  fastify.get<{ Params: { orderId: string } }>(
    '/api/quick-print/:orderId/status',
    {
      schema: {
        description: 'Get quick print order status',
        tags: ['quick-print'],
        params: {
          type: 'object',
          properties: { orderId: { type: 'string' } },
          required: ['orderId'],
        },
      },
    },
    async (request: FastifyRequest<{ Params: { orderId: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { orderId } = request.params;
      const userId = session.user.id;

      try {
        const order = await app.db.query.printJobs.findFirst({
          where: eq(schema.printJobs.id, orderId),
        });

        if (!order || order.userId !== userId) {
          return reply.status(404).send({
            success: false,
            error: 'Pedido não encontrado',
            code: 'NOT_FOUND',
          });
        }

        const options = (order.options || {}) as Record<string, any>;
        const estimatedTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        return {
          success: true,
          orderId,
          status: order.status,
          partnerName: options.storeInfo?.name,
          estimatedReadyTime: estimatedTime,
          qrCode: order.pdfUrl,
          message:
            order.status === 'pending'
              ? 'Aguardando aceite da impressão... Tempo estimado: 5-10 min'
              : 'Sua impressão está pronta!',
        };
      } catch (error) {
        app.logger.error({ err: error, userId, orderId }, 'Error fetching order status');
        return reply.status(500).send({
          success: false,
          error: 'Erro ao buscar status',
          code: 'SERVER_ERROR',
        });
      }
    }
  );
}
