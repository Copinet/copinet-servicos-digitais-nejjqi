ALTER TABLE "orders" ADD COLUMN "flow" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "selected_option" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "form_data" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pdf_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pdf_available_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "qr_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "partner_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "print_status" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "print_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "estimated_ready_time" timestamp with time zone;