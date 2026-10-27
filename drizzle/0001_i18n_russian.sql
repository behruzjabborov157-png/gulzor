ALTER TABLE "categories" ADD COLUMN "name_ru" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "description_ru" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "seo_title_ru" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "seo_description_ru" text;--> statement-breakpoint
ALTER TABLE "delivery_regions" ADD COLUMN "name_ru" text;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "name_ru" text;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "description_ru" text;--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN "params" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "locale" text DEFAULT 'uz' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "name_ru" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "name_ru" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "short_description_ru" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description_ru" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "care_instructions_ru" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "size_label_ru" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "flower_varieties_ru" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "color_options_ru" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "seo_title_ru" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "seo_description_ru" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "search_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Backfill search text for products created before this migration (the app keeps it current from now on).
UPDATE "products" SET "search_text" = lower(translate(
  "name" || ' ' || coalesce("name_ru", '') || ' ' || "short_description" || ' ' || "flower_varieties"::text,
  'ʻʼ‘’''`', ''));
