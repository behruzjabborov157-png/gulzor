import path from "node:path";
import { loadEnv } from "./env";
loadEnv();
import { closeDb, databaseKind, getDb } from "@/db";

async function main() {
  const db = await getDb();
  const migrationsFolder = path.resolve("drizzle");
  if (databaseKind() === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder });
  } else {
    // Customer names, addresses and card messages can be in any script — refuse non-UTF-8 databases.
    const { sql } = await import("drizzle-orm");
    const rows = (await db.execute(sql`SHOW server_encoding`)) as unknown as { server_encoding: string }[];
    const encoding = rows[0]?.server_encoding;
    if (encoding !== "UTF8") {
      throw new Error(
        `Database encoding is ${encoding}, but UTF8 is required. Recreate it with:\n` +
          `  CREATE DATABASE gulzor ENCODING 'UTF8' LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8' TEMPLATE template0;`,
      );
    }
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db as never, { migrationsFolder });
  }
  console.log(`Migrations applied (${databaseKind()}).`);
  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
