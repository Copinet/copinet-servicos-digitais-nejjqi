import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import { generatePdfFromImages, uploadGeneratedPdf } from '../utils/pdf-generator.js';
import { resend } from '@specific-dev/framework';

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
    // For Word files (.doc, .docx): client-indicated actual sheet/page count for printing
    // Required when uploading Word files - the actual page count will be verified at print time
    clientIndicatedSheetCount?: number;
    // For scan_to_pdf: PDF mode (single PDF or separate PDFs per page)
    pdfMode?: 'single' | 'multiple';
    // Image order for scan_to_pdf (array of image URLs in desired order)
    imageOrder?: string[];
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

  // GET /api/print-jobs/:id/download - Returns PDF download URL
  fastify.get('/api/print-jobs/:id/download', {
    schema: {
      description: 'Get PDF download URL for a print job',
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
            pdfUrl: { type: 'string' },
            filename: { type: 'string' },
            expiresIn: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const userId = session.user.id;
    app.logger.info({ printJobId: id, userId }, 'Requesting PDF download link');

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

    if (!printJob.pdfUrl) {
      app.logger.warn({ printJobId: id }, 'PDF not available for this print job');
      return reply.status(404).send({
        error: 'PDF não disponível para este pedido',
        code: 'PDF_NOT_AVAILABLE',
      });
    }

    const filename = `print-job-${id}.pdf`;
    app.logger.info({ printJobId: id, filename }, 'PDF download link provided');

    return {
      pdfUrl: printJob.pdfUrl,
      filename,
      expiresIn: '7 days',
    };
  });

  // POST /api/print-jobs/:id/share - Share PDF via email or WhatsApp
  fastify.post<{ Params: { id: string }; Body: { method: 'email' | 'whatsapp'; email?: string; phoneNumber?: string; message?: string } }>(
    '/api/print-jobs/:id/share',
    {
      schema: {
        description: 'Share generated PDF via email or WhatsApp',
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
            method: { type: 'string', enum: ['email', 'whatsapp'] },
            email: { type: 'string' },
            phoneNumber: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['method'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              shareableLink: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { method: 'email' | 'whatsapp'; email?: string; phoneNumber?: string; message?: string } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const { method, email, phoneNumber, message } = request.body;
      const userId = session.user.id;

      app.logger.info({ printJobId: id, userId, method }, 'Sharing print job PDF');

      // Fetch print job
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

      if (!printJob.pdfUrl) {
        app.logger.warn({ printJobId: id }, 'PDF not available for sharing');
        return reply.status(404).send({
          error: 'PDF não disponível para compartilhamento',
          code: 'PDF_NOT_AVAILABLE',
        });
      }

      try {
        if (method === 'email') {
          // Email sharing
          if (!email) {
            return reply.status(400).send({
              error: 'Email é obrigatório para compartilhamento por email',
              code: 'MISSING_EMAIL',
            });
          }

          app.logger.info({ printJobId: id, recipientEmail: email }, 'Sending PDF via email');

          const emailContent = message || 'Segue em anexo o arquivo PDF do seu pedido de impressão.';

          const { data, error } = await resend.emails.send({
            from: 'Copinet Serviços Digitais <noreply@copinet.com.br>',
            to: email,
            subject: `Seu PDF de Impressão - Pedido #${id.slice(0, 8)}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Seu PDF de Impressão</h2>
                <p>${emailContent}</p>
                <p>
                  <a href="${printJob.pdfUrl}" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                    Baixar PDF
                  </a>
                </p>
                <hr style="margin-top: 20px; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">
                  Este link expira em 7 dias. Baixe e guarde seu arquivo com segurança.
                </p>
                <p style="color: #666; font-size: 12px;">
                  Copinet Serviços Digitais
                </p>
              </div>
            `,
          });

          if (error) {
            app.logger.error(
              { printJobId: id, recipientEmail: email, error: error.message },
              'Failed to send email'
            );
            return reply.status(500).send({
              error: 'Falha ao enviar email',
              code: 'EMAIL_SEND_FAILED',
            });
          }

          app.logger.info(
            { printJobId: id, recipientEmail: email, emailId: data?.id },
            'PDF email sent successfully'
          );

          return {
            success: true,
            message: `PDF enviado para ${email} com sucesso`,
            shareableLink: printJob.pdfUrl,
          };
        } else if (method === 'whatsapp') {
          // WhatsApp sharing - generate shareable link and WhatsApp URL
          if (!phoneNumber) {
            return reply.status(400).send({
              error: 'Número de telefone é obrigatório para compartilhamento por WhatsApp',
              code: 'MISSING_PHONE',
            });
          }

          app.logger.info({ printJobId: id, phoneNumber }, 'Generating WhatsApp share link');

          // Format phone number (remove non-digits)
          const formattedPhone = phoneNumber.replace(/\D/g, '');

          // Create WhatsApp message with PDF link
          const whatsappMessage = message
            ? `${message}\n\nBaixe seu PDF: ${printJob.pdfUrl}`
            : `Segue o link do seu PDF de impressão: ${printJob.pdfUrl}`;

          // Create WhatsApp URL (WhatsApp Web format)
          const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappMessage)}`;

          app.logger.info(
            { printJobId: id, phoneNumber: formattedPhone },
            'WhatsApp share link generated'
          );

          return {
            success: true,
            message: `Link de compartilhamento do WhatsApp criado para ${phoneNumber}`,
            shareableLink: whatsappUrl,
          };
        }

        return reply.status(400).send({
          error: 'Método de compartilhamento inválido',
          code: 'INVALID_METHOD',
        });
      } catch (error) {
        app.logger.error(
          { printJobId: id, method, error: (error as Error).message },
          'Error sharing PDF'
        );
        return reply.status(500).send({
          error: 'Erro ao compartilhar PDF',
          code: 'SHARE_ERROR',
        });
      }
    }
  );

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
            pdfUrl: { type: 'string' },
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

    // For Word files, use client-indicated sheet count if provided
    let totalPages = 0;
    let hasWordFiles = false;

    // Check if any files are Word documents
    if (files.some(f => f.mimeType === 'application/msword' || f.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      hasWordFiles = true;

      if (!(options as any)?.clientIndicatedSheetCount || (options as any)?.clientIndicatedSheetCount <= 0) {
        app.logger.warn(
          { userId, serviceType, fileNames: files.map(f => f.name) },
          'Word file uploaded without client-indicated sheet count'
        );
        return reply.status(400).send({
          error: 'Para arquivos Word, é obrigatório indicar a quantidade real de páginas/folhas para impressão',
          code: 'WORD_SHEET_COUNT_REQUIRED',
          requiresSheetCount: true,
          hint: 'Envie novamente com a opção "clientIndicatedSheetCount" contendo o número real de páginas do documento Word',
        });
      }

      totalPages = (options as any).clientIndicatedSheetCount;
      app.logger.info(
        { userId, serviceType, clientSheetCount: totalPages, fileNames: files.map(f => f.name) },
        'Word file job: using client-indicated sheet count'
      );
    } else {
      // For other types, use pageCount from files
      totalPages = files.reduce((sum, file) => sum + (file.pageCount || 1), 0);
    }

    // Calculate price based on service type
    let totalPrice = 0;
    let pricePerPage = '0';
    let pdfUrl: string | null = null;

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

    // Create initial print job record
    let newPrintJob = await app.db
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

    const printJobId = newPrintJob[0].id;

    // For scan_to_pdf, generate PDF from images
    if (serviceType === 'scan_to_pdf') {
      try {
        app.logger.info({ printJobId, userId }, 'Starting PDF generation for scan_to_pdf');

        // Extract image URLs from files and apply ordering if specified
        let imageUrls = files.map(f => f.url);

        if ((options as any)?.imageOrder && Array.isArray((options as any).imageOrder)) {
          // Reorder images based on specified order
          const imageOrder = (options as any).imageOrder;
          imageUrls = imageOrder.filter(url => files.some(f => f.url === url));
          app.logger.info({ printJobId, reorderedCount: imageUrls.length }, 'Images reordered as per client specification');
        }

        // Generate PDF from images
        const pdfBuffer = await generatePdfFromImages(imageUrls, app.logger);

        // Upload generated PDF to storage
        pdfUrl = await uploadGeneratedPdf(app.storage, pdfBuffer, printJobId, userId, app.logger);

        // Update print job with PDF URL
        const updatedJob = await app.db
          .update(schema.printJobs)
          .set({
            pdfUrl,
            updatedAt: new Date(),
          })
          .where(eq(schema.printJobs.id, printJobId))
          .returning();

        newPrintJob = updatedJob;

        app.logger.info(
          { printJobId, pdfUrl, pdfSizeBytes: pdfBuffer.length },
          'PDF generated and uploaded successfully for scan_to_pdf job'
        );
      } catch (pdfError) {
        app.logger.error(
          { printJobId, userId, error: (pdfError as Error).message },
          'Failed to generate PDF for scan_to_pdf'
        );

        // Update job status to indicate PDF generation failure
        await app.db
          .update(schema.printJobs)
          .set({
            status: 'pdf_generation_failed',
            updatedAt: new Date(),
          })
          .where(eq(schema.printJobs.id, printJobId));

        return reply.status(500).send({
          error: 'Falha ao gerar PDF a partir das imagens',
          code: 'PDF_GENERATION_FAILED',
        });
      }
    }

    app.logger.info(
      { printJobId: newPrintJob[0].id, userId, serviceType, totalPages, totalPrice, hasWordFiles },
      'Print job created successfully'
    );

    // Prepare response with additional info for Word files
    const response: any = { ...newPrintJob[0] };

    // Add warning/info for Word files
    if (hasWordFiles) {
      response.wordFileNotice = {
        message: 'Arquivo Word detectado',
        details: 'A contagem de páginas de arquivos Word é de responsabilidade do cliente. A quantidade indicada será verificada durante a impressão.',
        sheetCountVerification: 'O número de páginas/folhas será verificado no momento da impressão',
      };
    }

    return reply.status(201).send(response);
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
