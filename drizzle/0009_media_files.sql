CREATE TABLE "media_files" (
	"path" text PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
