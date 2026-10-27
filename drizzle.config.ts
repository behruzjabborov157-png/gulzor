import { defineConfig } from "drizzle-kit";

// Migrations are generated from the schema and applied by scripts/migrate.ts
// (works for both embedded PGlite and a real PostgreSQL server).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
