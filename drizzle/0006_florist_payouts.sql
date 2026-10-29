CREATE TABLE "commission_statements" (
	"id" serial PRIMARY KEY NOT NULL,
	"florist_id" integer NOT NULL,
	"period" text NOT NULL,
	"order_count" integer NOT NULL,
	"goods_total" integer NOT NULL,
	"commission_total" integer NOT NULL,
	"status" text DEFAULT 'unpaid' NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "florists" ADD COLUMN "telegram_chat_id" text;--> statement-breakpoint
ALTER TABLE "florists" ADD COLUMN "telegram_link_token" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "commission_statement_id" integer;--> statement-breakpoint
ALTER TABLE "commission_statements" ADD CONSTRAINT "commission_statements_florist_id_florists_id_fk" FOREIGN KEY ("florist_id") REFERENCES "public"."florists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_statement_period_idx" ON "commission_statements" USING btree ("florist_id","period");--> statement-breakpoint
CREATE INDEX "commission_statement_status_idx" ON "commission_statements" USING btree ("status");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_commission_statement_id_commission_statements_id_fk" FOREIGN KEY ("commission_statement_id") REFERENCES "public"."commission_statements"("id") ON DELETE set null ON UPDATE no action;