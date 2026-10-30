import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { handleUpdate, type Update } from "@/lib/bot/handler";
import { notifyNewOrder } from "@/lib/orders";
import { webhookSecret } from "@/lib/telegram-miniapp";

export const dynamic = "force-dynamic";

function secretOk(given: string | null) {
  const expected = webhookSecret();
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Shop bot webhook (registered by `npm run telegram:setup`). Telegram proves the request is genuine
 * with the secret token header; the ordering conversation itself lives in src/lib/bot/handler.ts.
 */
export async function POST(request: Request) {
  if (!secretOk(request.headers.get("x-telegram-bot-api-secret-token"))) return new Response("Forbidden", { status: 403 });
  const update = (await request.json().catch(() => ({}))) as Update;
  const task = await handleUpdate(update);
  if (task) after(() => notifyNewOrder(task.notifyOrderId));
  // Always 200 so Telegram does not keep re-sending the update.
  return Response.json({ ok: true });
}
