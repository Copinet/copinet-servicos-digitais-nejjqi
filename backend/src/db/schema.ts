import {
  pgTable,
  text,
  uuid,
  decimal,
  timestamp,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';

// Services table
export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // "documents", "printing", "graphics"
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  estimatedTime: text('estimated_time'), // e.g., "2-3 dias úteis"
  icon: text('icon'), // icon name
  type: text('type').default('fazemos_pra_voce').notNull(), // "fazemos_pra_voce", "faca_sozinho", "both"
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Orders table
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(), // from auth
  serviceId: uuid('service_id').notNull(), // references services
  status: text('status').notNull(), // "pending", "processing", "ready", "completed", "cancelled"
  flow: text('flow').notNull(), // "fazemos", "sozinho"
  selectedOption: text('selected_option').notNull(), // "pdf", "pdf_impressao"
  formData: jsonb('form_data'), // user collected data
  customerData: jsonb('customer_data'), // stores extracted data (name, cpf, rg, birthDate, etc.)
  documentImages: jsonb('document_images'), // array of image URLs
  notes: text('notes'),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  pdfUrl: text('pdf_url'), // URL of generated PDF
  pdfAvailableUntil: timestamp('pdf_available_until', { withTimezone: true }), // PDF available for 3 days
  qrCode: text('qr_code'), // QR code for print pickup
  partnerId: text('partner_id'), // foreign key to partners if print selected
  printStatus: text('print_status'), // "pending", "accepted", "rejected", "completed"
  printAcceptedAt: timestamp('print_accepted_at', { withTimezone: true }), // when partner accepted the order
  estimatedReadyTime: timestamp('estimated_ready_time', { withTimezone: true }), // when print will be ready
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Partners table
export const partners = pgTable('partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(), // from auth
  businessName: text('business_name').notNull(),
  address: text('address').notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
  phone: text('phone').notNull(),
  servicesOffered: jsonb('services_offered'), // array of service IDs
  isApproved: boolean('is_approved').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Stores table
export const stores = pgTable('stores', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
  phone: text('phone').notNull(),
  isOwned: boolean('is_owned').default(true).notNull(), // true for Copinet's own stores
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
