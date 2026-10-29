CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"actor_email" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "florists" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_ru" text,
	"description" text DEFAULT '' NOT NULL,
	"description_ru" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_reason" text,
	"is_platform" boolean DEFAULT false NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"telegram_username" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"address_ru" text,
	"region_id" integer,
	"legal_name" text DEFAULT '' NOT NULL,
	"tax_id" text DEFAULT '' NOT NULL,
	"commission_rate" integer DEFAULT 1000 NOT NULL,
	"logo_url" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "florist_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "commission_rate" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "commission_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Existing data belongs to the platform's own shop "Gulzor" (created here), then the links become mandatory.
INSERT INTO "florists" ("slug", "name", "status", "is_platform", "commission_rate", "approved_at") VALUES ('gulzor', 'Gulzor', 'approved', true, 0, now());--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "florist_id" integer;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "florist_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "florist_id" integer;--> statement-breakpoint
UPDATE "products" SET "florist_id" = (SELECT "id" FROM "florists" WHERE "slug" = 'gulzor');--> statement-breakpoint
UPDATE "delivery_zones" SET "florist_id" = (SELECT "id" FROM "florists" WHERE "slug" = 'gulzor');--> statement-breakpoint
UPDATE "orders" SET "florist_id" = (SELECT "id" FROM "florists" WHERE "slug" = 'gulzor');--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "florist_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_zones" ALTER COLUMN "florist_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "florist_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "florists" ADD CONSTRAINT "florists_region_id_delivery_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."delivery_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "florists_slug_idx" ON "florists" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "florists_status_idx" ON "florists" USING btree ("status");--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_florist_id_florists_id_fk" FOREIGN KEY ("florist_id") REFERENCES "public"."florists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_florist_id_florists_id_fk" FOREIGN KEY ("florist_id") REFERENCES "public"."florists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_florist_id_florists_id_fk" FOREIGN KEY ("florist_id") REFERENCES "public"."florists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_florist_id_florists_id_fk" FOREIGN KEY ("florist_id") REFERENCES "public"."florists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_florist_idx" ON "orders" USING btree ("florist_id");--> statement-breakpoint
CREATE INDEX "products_florist_idx" ON "products" USING btree ("florist_id");