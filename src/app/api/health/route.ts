import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

/** Uptime check for monitoring (UptimeRobot, etc.): 200 when the app and database respond, 503 otherwise. */
export async function GET() {
  const started = Date.now();
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    return Response.json({ status: "ok", db: "ok", ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // No error details: this endpoint is public.
    return Response.json({ status: "error", db: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
