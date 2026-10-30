import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { clientIp } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Uptime check for monitoring (UptimeRobot, etc.): 200 when the app and database respond, 503 otherwise. */
export async function GET(request: Request) {
  const started = Date.now();
  // ?ip shows the address the rate limiter sees for this request (setting up CLIENT_IP_HEADER / TRUSTED_PROXY_HOPS).
  if (new URL(request.url).searchParams.has("ip")) return Response.json({ ip: await clientIp() }, { headers: { "Cache-Control": "no-store" } });
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    return Response.json({ status: "ok", db: "ok", ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // No error details: this endpoint is public.
    return Response.json({ status: "error", db: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
