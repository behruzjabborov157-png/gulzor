/** Prints row counts — a quick sanity check that the database opens and is populated. */
import { loadEnv } from "./env";
loadEnv();
import { sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "@/db";

async function main() {
  const db = await getDb();
  for (const [name, t] of Object.entries({ products: schema.products, categories: schema.categories, orders: schema.orders, admins: schema.adminUsers, zones: schema.deliveryZones })) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t);
    console.log(`${name}: ${n}`);
  }
  await closeDb();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
