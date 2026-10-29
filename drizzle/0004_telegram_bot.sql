CREATE TABLE "tg_media" (
	"url" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tg_sessions" (
	"chat_id" text PRIMARY KEY NOT NULL,
	"locale" text,
	"step" text DEFAULT 'idle' NOT NULL,
	"cart" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "longitude" double precision;