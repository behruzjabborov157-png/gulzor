CREATE TYPE "public"."availability" AS ENUM('in_stock', 'made_to_order', 'out_of_stock');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('flower', 'bouquet_type', 'occasion', 'collection');--> statement-breakpoint
CREATE TYPE "public"."coupon_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."fulfillment" AS ENUM('delivery', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'confirmed', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'payme', 'click');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."pricing_mode" AS ENUM('fixed', 'variants', 'per_stem');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'draft', 'archived');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "category_kind" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"seo_title" text,
	"seo_description" text
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" "coupon_type" NOT NULL,
	"value" integer NOT NULL,
	"min_subtotal" integer DEFAULT 0 NOT NULL,
	"max_discount" integer,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"occasion" text DEFAULT '' NOT NULL,
	"budget" integer,
	"desired_date" date,
	"colors" text DEFAULT '' NOT NULL,
	"description" text NOT NULL,
	"image_path" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"label" text DEFAULT 'Manzil' NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"region_id" integer,
	"zone_id" integer,
	"district" text DEFAULT '' NOT NULL,
	"neighborhood" text DEFAULT '' NOT NULL,
	"address" text NOT NULL,
	"apartment" text DEFAULT '' NOT NULL,
	"landmark" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_regions" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"region_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"fee" integer DEFAULT 0 NOT NULL,
	"free_from" integer,
	"min_order" integer,
	"same_day_enabled" boolean DEFAULT true NOT NULL,
	"same_day_cutoff" text DEFAULT '18:00' NOT NULL,
	"min_lead_minutes" integer DEFAULT 120 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"customer_id" uuid NOT NULL,
	"product_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_customer_id_product_id_pk" PRIMARY KEY("customer_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" uuid,
	"channel" text DEFAULT 'telegram' NOT NULL,
	"status" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"type" text NOT NULL,
	"to_status" text,
	"message" text DEFAULT '' NOT NULL,
	"actor" text DEFAULT 'system' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" integer,
	"variant_id" integer,
	"product_name" text NOT NULL,
	"variant_name" text,
	"stems" integer,
	"color" text,
	"image_url" text,
	"unit_price" integer NOT NULL,
	"quantity" integer NOT NULL,
	"addons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"line_total" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"access_token" text NOT NULL,
	"customer_id" uuid,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"fulfillment" "fulfillment" NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"region_id" integer,
	"zone_id" integer,
	"region_name" text,
	"zone_name" text,
	"district" text DEFAULT '' NOT NULL,
	"neighborhood" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"apartment" text DEFAULT '' NOT NULL,
	"landmark" text DEFAULT '' NOT NULL,
	"delivery_date" date NOT NULL,
	"slot_id" integer,
	"slot_label" text NOT NULL,
	"courier_note" text DEFAULT '' NOT NULL,
	"card_message" text DEFAULT '' NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"delivery_fee" integer DEFAULT 0 NOT NULL,
	"service_fee" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"coupon_code" text,
	"contains_demo" boolean DEFAULT false NOT NULL,
	"admin_note" text DEFAULT '' NOT NULL,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_transaction_id" text NOT NULL,
	"amount" integer NOT NULL,
	"state" integer NOT NULL,
	"reason" integer,
	"provider_create_time" text,
	"create_time" timestamp with time zone DEFAULT now() NOT NULL,
	"perform_time" timestamp with time zone,
	"cancel_time" timestamp with time zone,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"product_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	CONSTRAINT "product_categories_product_id_category_id_pk" PRIMARY KEY("product_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"name" text NOT NULL,
	"stem_count" integer,
	"price" integer NOT NULL,
	"compare_at_price" integer,
	"stock_quantity" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"care_instructions" text DEFAULT '' NOT NULL,
	"flower_varieties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stem_count" integer,
	"size_label" text,
	"primary_category_id" integer,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pricing_mode" "pricing_mode" DEFAULT 'fixed' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"compare_at_price" integer,
	"stem_price" integer,
	"min_stems" integer,
	"max_stems" integer,
	"stem_step" integer DEFAULT 1 NOT NULL,
	"color_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"availability" "availability" DEFAULT 'in_stock' NOT NULL,
	"stock_quantity" integer,
	"seasonal_months" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prep_time_minutes" integer DEFAULT 60 NOT NULL,
	"delivery_eligible" boolean DEFAULT true NOT NULL,
	"pickup_eligible" boolean DEFAULT true NOT NULL,
	"is_addon" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"price_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_type" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"consent_text" text NOT NULL,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "time_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"capacity" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_region_id_delivery_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."delivery_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_zone_id_delivery_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_region_id_delivery_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."delivery_regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_primary_category_id_categories_id_fk" FOREIGN KEY ("primary_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_email_idx" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_idx" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "regions_slug_idx" ON "delivery_regions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_idx" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE INDEX "orders_phone_idx" ON "orders" USING btree ("customer_phone");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_tx_idx" ON "payments" USING btree ("provider","provider_transaction_id");--> statement-breakpoint
CREATE INDEX "pc_category_idx" ON "product_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_price_idx" ON "products" USING btree ("price");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_phone_idx" ON "subscribers" USING btree ("phone");