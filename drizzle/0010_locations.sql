CREATE TYPE "public"."location_level" AS ENUM('region', 'district', 'settlement', 'mahalla');--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"level" "location_level" NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"name_cyrl" text,
	"name_ru" text,
	"name_en" text,
	"latitude" double precision,
	"longitude" double precision,
	"search_text" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_locations" (
	"zone_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	CONSTRAINT "zone_locations_zone_id_location_id_pk" PRIMARY KEY("zone_id","location_id")
);
--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD COLUMN "district_id" integer;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD COLUMN "mahalla_id" integer;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "delivery_regions" ADD COLUMN "location_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "district_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mahalla_id" integer;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_locations" ADD CONSTRAINT "zone_locations_zone_id_delivery_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_locations" ADD CONSTRAINT "zone_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "locations_code_idx" ON "locations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "locations_parent_idx" ON "locations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "locations_level_idx" ON "locations" USING btree ("level");--> statement-breakpoint
CREATE INDEX "zone_locations_location_idx" ON "zone_locations" USING btree ("location_id");--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_district_id_locations_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_mahalla_id_locations_id_fk" FOREIGN KEY ("mahalla_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_regions" ADD CONSTRAINT "delivery_regions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_district_id_locations_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_mahalla_id_locations_id_fk" FOREIGN KEY ("mahalla_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;