/**
 * Click SHOP API (Prepare / Complete) — called server-to-server by Click.
 * Docs: https://docs.click.uz/click-api-request/
 *
 * merchant_trans_id = our order number. Signature:
 *   md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + [merchant_prepare_id] + amount + action + sign_time)
 *
 * Must be verified with Click's test tools and real merchant credentials before going live.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { clickCredentials } from "./config";
import { markOrderPaid, markOrderPaymentCancelled } from "./status";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

type ClickResponse = Record<string, string | number | null>;

function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function clickRequest(form: URLSearchParams, action: 0 | 1): Promise<ClickResponse> {
  const creds = clickCredentials();
  const f = (k: string) => form.get(k) ?? "";
  const base = { click_trans_id: f("click_trans_id"), merchant_trans_id: f("merchant_trans_id") };
  const fail = (error: number, note: string): ClickResponse => ({ ...base, error, error_note: note });

  if (!creds) return fail(-8, "Merchant not configured");
  if (String(action) !== f("action")) return fail(-3, "Action not found");
  if (f("service_id") !== creds.serviceId) return fail(-8, "Error in request from click");

  const signSource =
    f("click_trans_id") +
    f("service_id") +
    creds.secretKey +
    f("merchant_trans_id") +
    (action === 1 ? f("merchant_prepare_id") : "") +
    f("amount") +
    f("action") +
    f("sign_time");
  if (!safeEq(md5(signSource), f("sign_string").toLowerCase())) return fail(-1, "SIGN CHECK FAILED!");

  const db = await getDb();
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.number, f("merchant_trans_id")));
  if (!order || order.paymentMethod !== "click") return fail(-5, "User does not exist");
  if (Math.round(Number(f("amount")) * 100) !== order.total * 100) return fail(-2, "Incorrect parameter amount");
  if (order.paymentStatus === "paid") return fail(-4, "Already paid");
  if (order.status === "cancelled" || order.status === "rejected") return fail(-9, "Transaction cancelled");

  if (action === 0) {
    const [existing] = await db
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.provider, "click"), eq(schema.payments.providerTransactionId, f("click_trans_id"))));
    const row =
      existing ??
      (
        await db
          .insert(schema.payments)
          .values({
            orderId: order.id,
            provider: "click",
            providerTransactionId: f("click_trans_id"),
            amount: order.total,
            state: 0,
            raw: Object.fromEntries(form),
          })
          .returning()
      )[0];
    return { ...base, merchant_prepare_id: row.id, error: 0, error_note: "Success" };
  }

  // Complete
  const prepareId = Number(f("merchant_prepare_id"));
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.id, prepareId), eq(schema.payments.provider, "click"), eq(schema.payments.orderId, order.id)));
  if (!payment) return fail(-6, "Transaction does not exist");
  if (payment.state === 1) return fail(-4, "Already paid");
  if (payment.state === -1) return fail(-9, "Transaction cancelled");

  if (Number(f("error")) < 0) {
    await db.update(schema.payments).set({ state: -1, cancelTime: new Date() }).where(eq(schema.payments.id, payment.id));
    await markOrderPaymentCancelled(order.id, "click", "failed", `Click: to‘lov amalga oshmadi (${f("error_note") || f("error")})`);
    return fail(-9, "Transaction cancelled");
  }

  await db.update(schema.payments).set({ state: 1, performTime: new Date() }).where(eq(schema.payments.id, payment.id));
  await markOrderPaid(order.id, "click", payment.amount);
  return { ...base, merchant_confirm_id: payment.id, error: 0, error_note: "Success" };
}

export function clickCheckoutUrl(orderNumber: string, total: number, returnUrl: string): string | null {
  const creds = clickCredentials();
  if (!creds) return null;
  const u = new URL("https://my.click.uz/services/pay");
  u.searchParams.set("service_id", creds.serviceId);
  u.searchParams.set("merchant_id", creds.merchantId);
  if (creds.merchantUserId) u.searchParams.set("merchant_user_id", creds.merchantUserId);
  u.searchParams.set("amount", String(total));
  u.searchParams.set("transaction_param", orderNumber);
  u.searchParams.set("return_url", returnUrl);
  return u.toString();
}
