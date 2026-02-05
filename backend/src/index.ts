import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';

// Import route registration functions
import { registerServicesRoutes } from './routes/services.js';
import { registerOrdersRoutes } from './routes/orders.js';
import { registerAIRoutes } from './routes/ai.js';
import { registerUploadRoutes } from './routes/upload.js';
import { registerPartnersRoutes } from './routes/partners.js';
import { registerStoresRoutes } from './routes/stores.js';
import { registerPrintJobsRoutes } from './routes/print-jobs.js';
import { registerPricingRoutes } from './routes/pricing.js';
import { registerAIImageRoutes } from './routes/ai-image.js';
import { registerQuickPrintRoutes } from './routes/quick-print.js';
import { seedInitialServices } from './db/seed.js';
import { seedPricingConfig } from './db/seed-pricing.js';

// Combine schemas for full database type support
const schema = { ...appSchema, ...authSchema };

// Create application with combined schema
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Configure server limits for large file uploads
// Server is configured to accept payloads up to 50MB (52428800 bytes)
// Socket timeout is set to 60 seconds for processing large files
app.fastify.addHook('onRequest', async (request, reply) => {
  // Set socket timeout for upload and print-jobs routes (60 seconds)
  if (request.url.includes('/api/upload') || request.url.includes('/api/print-jobs')) {
    request.socket.setTimeout(60000); // 60 seconds
  }
});

// Enable authentication
app.withAuth();

// Enable storage for file uploads
// The storage automatically handles multipart uploads with proper limits
app.withStorage();

// Register all route modules
registerServicesRoutes(app, app.fastify);
registerOrdersRoutes(app, app.fastify);
registerAIRoutes(app, app.fastify);
registerUploadRoutes(app, app.fastify);
registerPartnersRoutes(app, app.fastify);
registerStoresRoutes(app, app.fastify);
registerPrintJobsRoutes(app, app.fastify);
registerPricingRoutes(app, app.fastify);
registerAIImageRoutes(app, app.fastify);
registerQuickPrintRoutes(app, app.fastify);

// Seed initial data on startup
await seedInitialServices(app);
await seedPricingConfig(app);

await app.run();
app.logger.info('Application running');
