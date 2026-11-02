import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { isLocale } from "@/i18n/config";
import { getCustomer } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Remembers the language a signed-in customer switched to (language menu), so later messages use it.
 * JSON only: a plain cross-site form cannot send this content type without a CORS preflight.
 */
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new Response(null, { status: 415 });
  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  if (!isLocale(body?.locale)) return new Response(null, { status: 400 });
  const customer = await getCustomer();
  if (customer) await (await getDb()).update(schema.customers).set({ locale: body.locale }).where(eq(schema.customers.id, customer.id));
  return new Response(null, { status: 204 });
}
