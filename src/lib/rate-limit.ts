import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

const { rateLimits: t } = schema;

/**
 * Fixed-window rate limiter stored in the database (works across processes).
 * A single atomic upsert increments the counter (or starts a new window), so
 * concurrent requests cannot slip past the limit. Returns true when allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const db = await getDb();
  const expired = sql`${t.windowStart} < now() - (${windowSeconds}::int * interval '1 second')`;
  const [row] = await db
    .insert(t)
    .values({ key, count: 1, windowStart: sql`now()` })
    .onConflictDoUpdate({
      target: t.key,
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${t.count} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN now() ELSE ${t.windowStart} END`,
      },
    })
    .returning({ count: t.count });
  return row.count <= limit;
}

export async function resetRateLimit(key: string) {
  const db = await getDb();
  await db.delete(t).where(eq(t.key, key));
}
