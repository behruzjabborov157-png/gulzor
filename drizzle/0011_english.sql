ALTER TABLE "categories" ADD COLUMN "name_en" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "description_en" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "seo_title_en" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "seo_description_en" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "locale" text DEFAULT 'uz' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_regions" ADD COLUMN "name_en" text;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "name_en" text;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "description_en" text;--> statement-breakpoint
ALTER TABLE "florists" ADD COLUMN "name_en" text;--> statement-breakpoint
ALTER TABLE "florists" ADD COLUMN "description_en" text;--> statement-breakpoint
ALTER TABLE "florists" ADD COLUMN "address_en" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "name_en" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "name_en" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "short_description_en" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description_en" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "care_instructions_en" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "size_label_en" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "flower_varieties_en" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "color_options_en" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "seo_title_en" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "seo_description_en" text;