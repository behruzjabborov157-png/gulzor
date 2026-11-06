ALTER TABLE "tg_sessions" ADD COLUMN "favorites" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tg_sessions" ADD COLUMN "profile" jsonb DEFAULT '{}'::jsonb NOT NULL;