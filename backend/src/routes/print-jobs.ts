import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

interface CreatePrintJobBody {
  serviceType: 'quick_print' | 'photo_print' | 'photo_3x4' | 'scan_to_pdf';
  files: Array<{
    url: string;
    name: string;
    size: number;
    mimeType: string;
    pageCount: number;
  }>;
  options: {
    colorMode?: string;
    copies?: number;
    paperType?: string;
    paperSize?: string;
    pageRange?: string;
    notes?: string;
  };
}

interface UpdatePrintJobBody {
  status?: string;
  pdfUrl?: string;
}

export function registerPrintJobsRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // Add timeout hook for print-jobs routes (60 seconds for PDF processing)
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url.includes('/api/print-jobs')) {
      request.socket.setTimeout(60000); // 60 seconds
    }
  });

  // GET /api/print-jobs - Returns all print jobs for authenticated user
  fastify.get('/api/print-jobs', {
    schema: {
      description: 'Get all print jobs for authenticated user',
      tags: ['print-jobs'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              serviceType: { type: 'string' },
              files: { type: 'array' },
              options: { type: 'object' },
              totalPages: { type: 'string' },
              totalPrice: { type: 'string' },
              status: { type: 'string' },
              pdfUrl: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching user print jobs');

    const userPrintJobs = await app.db.query.printJobs.findMany({
      where: eq(schema.printJobs.userId, userId),
    });

    app.logger.info({ userId, count: userPrintJobs.length }, 'Print jobs fetched successfully');
    return userPrintJobs;
  });

  // GET /api/print-jobs/:id - Returns single print job details
  fastify.get('/api/print-jobs/:id', {
    schema: {
      description: 'Get print job details by ID',
      tags: ['print-jobs'],
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
            serviceType: { type: 'string' },
            files: { type: 'array' },
            options: { type: 'object' },
            totalPages: { type: 'string' },
            totalPrice: { type: 'string' },
            status: { type: 'string' },
            pdfUrl: { type: 'string' },
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
    app.logger.info({ printJobId: id, userId }, 'Fetching print job details');

    const printJob = await app.db.query.printJobs.findFirst({
      where: eq(schema.printJobs.id, id),
    });

    if (!printJob) {
      app.logger.warn({ printJobId: id }, 'Print job not found');
      return reply.status(404).send({ error: 'Print job not found' });
    }

    if (printJob.userId !== userId) {
      app.logger.warn({ printJobId: id, userId, jobUserId: printJob.userId }, 'Unauthorized access to print job');
      return reply.status(403).send({ error: 'Unauthorized' });
    }

    app.logger.info({ printJobId: id }, 'Print job details fetched successfully');
    return printJob;
  });

  // POST /api/print-jobs - Creates print job
  fastify.post('/api/print-jobs', {
    schema: {
      description: 'Create a new print job',
      tags: ['print-jobs'],
      body: {
        type: 'object',
        properties: {
          serviceType: { type: 'string', enum: ['quick_print', 'photo_print', 'photo_3x4', 'scan_to_pdf'] },
          files: { type: 'array' },
          options: { type: 'object' },
        },
        required: ['serviceType', 'files', 'options'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            serviceType: { type: 'string' },
            totalPages: { type: 'string' },
            totalPrice: { type: 'string' },
            status: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: CreatePrintJobBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { serviceType, files, options } = request.body;
    const userId = session.user.id;
    app.logger.info({ userId, serviceType, fileCount: files.length }, 'Creating print job');

    // Get pricing configuration
    const pricingConfig = await app.db.query.pricingConfig.findFirst({
      where: eq(schema.pricingConfig.serviceType, serviceType),
    });

    if (!pricingConfig) {
      app.logger.warn({ serviceType }, 'Pricing config not found');
      return reply.status(404).send({ error: 'Service type not found' });
    }

    // Calculate total pages
    const totalPages = files.reduce((sum, file) => sum + (file.pageCount || 1), 0);

    // Calculate price based on service type
    let totalPrice = 0;
    let pricePerPage = '0';

    if (serviceType === 'photo_3x4') {
      totalPrice = parseFloat(pricingConfig.pricePerPage || '0');
      pricePerPage = pricingConfig.pricePerPage || '0';
    } else if (serviceType === 'photo_print') {
      // For photo prints, price is determined by size selection in options
      const photoSize = (options as any)?.photoSize;
      const photoSizes = (pricingConfig.photoSizes as any) || {};
      const sizePrice = photoSize ? photoSizes[photoSize] : 0;
      totalPrice = (sizePrice || 0) * (options.copies || 1);
      pricePerPage = String(sizePrice || 0);
    } else {
      // quick_print and scan_to_pdf use per-page pricing
      pricePerPage = pricingConfig.pricePerPage || '0';
      totalPrice = totalPages * parseFloat(pricePerPage);
    }

    const newPrintJob = await app.db
      .insert(schema.printJobs)
      .values({
        userId,
        serviceType,
        files,
        options,
        totalPages: String(totalPages),
        pricePerPage: String(pricePerPage),
        totalPrice: String(totalPrice),
        status: 'pending',
      })
      .returning();

    app.logger.info({ printJobId: newPrintJob[0].id, userId }, 'Print job created successfully');
    return reply.status(201).send(newPrintJob[0]);
  });

  // PUT /api/print-jobs/:id - Updates print job
  fastify.put('/api/print-jobs/:id', {
    schema: {
      description: 'Update print job',
      tags: ['print-jobs'],
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
          pdfUrl: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            pdfUrl: { type: 'string' },
            updatedAt: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: UpdatePrintJobBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const { status, pdfUrl } = request.body;
    const userId = session.user.id;
    app.logger.info({ printJobId: id, userId, status }, 'Updating print job');

    const printJob = await app.db.query.printJobs.findFirst({
      where: eq(schema.printJobs.id, id),
    });

    if (!printJob) {
      app.logger.warn({ printJobId: id }, 'Print job not found');
      return reply.status(404).send({ error: 'Print job not found' });
    }

    if (printJob.userId !== userId) {
      app.logger.warn({ printJobId: id, userId }, 'Unauthorized update attempt');
      return reply.status(403).send({ error: 'Unauthorized' });
    }

    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (pdfUrl) updateData.pdfUrl = pdfUrl;

    const updatedJob = await app.db
      .update(schema.printJobs)
      .set(updateData)
      .where(eq(schema.printJobs.id, id))
      .returning();

    app.logger.info({ printJobId: id }, 'Print job updated successfully');
    return updatedJob[0];
  });

  // POST /api/print-jobs/:id/assign-partner - Assign partner to print job
  fastify.post<{ Params: { id: string }; Body: { partnerId: string; storeId?: string } }>(
    '/api/print-jobs/:id/assign-partner',
    {
      schema: {
        description: 'Assign a partner or store to a print job',
        tags: ['print-jobs'],
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
            partnerId: { type: 'string' },
            storeId: { type: 'string' },
          },
          required: ['partnerId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              printJob: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                  partnerId: { type: 'string' },
                  partnerName: { type: 'string' },
                  estimatedReadyTime: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { partnerId: string; storeId?: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const printJobId = request.params.id;
      const { partnerId, storeId } = request.body;
      const userId = session.user.id;

      app.logger.info(
        { printJobId, userId, partnerId, storeId },
        'Assigning partner to print job'
      );

      // Find the print job
      const printJob = await app.db.query.printJobs.findFirst({
        where: eq(schema.printJobs.id, printJobId),
      });

      if (!printJob) {
        app.logger.warn({ printJobId }, 'Print job not found');
        return reply.status(404).send({
          success: false,
          error: 'Pedido não encontrado',
          code: 'NOT_FOUND',
        });
      }

      // Verify ownership
      if (printJob.userId !== userId) {
        app.logger.warn({ printJobId, userId, jobUserId: printJob.userId }, 'Unauthorized partner assignment');
        return reply.status(403).send({
          success: false,
          error: 'Não autorizado para atualizar este pedido',
          code: 'UNAUTHORIZED',
        });
      }

      try {
        // Get partner or store details
        let partnerName = '';
        let partnerInfo: any = null;
        let isStore = false;

        // First, try to find in stores table (if storeId provided or partnerId could be a store ID)
        const storeQuery = storeId || partnerId;
        const store = await app.db.query.stores.findFirst({
          where: eq(schema.stores.id, storeQuery),
        });

        if (store) {
          partnerName = store.name as string;
          partnerInfo = store;
          isStore = true;
          app.logger.info({ storeId: storeQuery, storeName: partnerName }, 'Store found');
        }

        // If no store found, try to find in partners table
        if (!partnerInfo) {
          const partner = await app.db.query.partners.findFirst({
            where: eq(schema.partners.id, partnerId),
          });
          if (partner) {
            partnerName = partner.businessName as string;
            partnerInfo = partner;
            app.logger.info({ partnerId, partnerName }, 'Partner found');
          }
        }

        // If still not found, return error
        if (!partnerInfo) {
          app.logger.warn(
            { partnerId, storeId, searchedId: storeQuery },
            'Partner/store not found in database'
          );
          return reply.status(404).send({
            success: false,
            error: 'Erro ao conectar com a loja. Verifique se a loja está cadastrada.',
            code: 'PARTNER_NOT_FOUND',
          });
        }

        // Calculate estimated ready time (10-15 minutes from now)
        const estimatedReadyTime = new Date(Date.now() + 12 * 60 * 1000).toISOString();

        // Update print job
        const existingOptions = (printJob.options || {}) as Record<string, any>;
        const updatedJob = await app.db
          .update(schema.printJobs)
          .set({
            options: {
              ...existingOptions,
              assignedPartnerId: partnerId,
              assignedStoreId: storeId,
              partnerName,
              estimatedReadyTime,
            } as any,
            status: 'partner_assigned',
            updatedAt: new Date(),
          })
          .where(eq(schema.printJobs.id, printJobId))
          .returning();

        app.logger.info(
          { printJobId, partnerId, partnerName, status: 'partner_assigned' },
          'Partner assigned successfully'
        );

        return {
          success: true,
          printJob: {
            id: updatedJob[0].id,
            status: updatedJob[0].status,
            partnerId,
            partnerName,
            estimatedReadyTime,
          },
        };
      } catch (error) {
        app.logger.error(
          { printJobId, partnerId, error: (error as Error).message },
          'Error assigning partner'
        );
        return reply.status(500).send({
          success: false,
          error: 'Erro ao atribuir parceiro. Tente novamente.',
          code: 'ASSIGNMENT_ERROR',
        });
      }
    }
  );

  // DELETE /api/print-jobs/:id - Deletes print job
  fastify.delete('/api/print-jobs/:id', {
    schema: {
      description: 'Delete print job',
      tags: ['print-jobs'],
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
            success: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const userId = session.user.id;
    app.logger.info({ printJobId: id, userId }, 'Deleting print job');

    const printJob = await app.db.query.printJobs.findFirst({
      where: eq(schema.printJobs.id, id),
    });

    if (!printJob) {
      app.logger.warn({ printJobId: id }, 'Print job not found');
      return reply.status(404).send({ error: 'Print job not found' });
    }

    if (printJob.userId !== userId) {
      app.logger.warn({ printJobId: id, userId }, 'Unauthorized deletion attempt');
      return reply.status(403).send({ error: 'Unauthorized' });
    }

    await app.db.delete(schema.printJobs).where(eq(schema.printJobs.id, id));

    app.logger.info({ printJobId: id }, 'Print job deleted successfully');
    return { success: true };
  });
}
