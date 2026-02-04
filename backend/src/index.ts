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
import { seedInitialServices } from './db/seed.js';

// Combine schemas for full database type support
const schema = { ...appSchema, ...authSchema };

// Create application with combined schema
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Enable authentication
app.withAuth();

// Enable storage for file uploads
app.withStorage();

// Register all route modules
registerServicesRoutes(app, app.fastify);
registerOrdersRoutes(app, app.fastify);
registerAIRoutes(app, app.fastify);
registerUploadRoutes(app, app.fastify);
registerPartnersRoutes(app, app.fastify);
registerStoresRoutes(app, app.fastify);

// Seed initial services on startup
await seedInitialServices(app);

await app.run();
app.logger.info('Application running');
