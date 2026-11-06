import { and, eq, notInArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { notifyCustomerTelegram } from "@/lib/customer-telegram";
import { formatUZS } from "@/lib/format";
import { notifyOrder } from "@/lib/telegram";

export type ProviderId = "payme" | "click";
const LABEL: Record<ProviderId, string> = { payme: "Payme", click: "Click" };

export type SettleResult = "paid" | "already" | "closed" | "order-paid" | "stale";

/**
 * The one place that marks an order as paid. Called only from verified server-to-server provider callbacks.
 * The order row is locked, so parallel or repeated callbacks settle at most once, a closed order is never paid,
 * and a second transaction cannot pay an order twice. `fromState` is the state the transaction must still be in.
 */
export async function settlePayment(p: { paymentId: number; orderId: string; provider: ProviderId; fromState: number; toState: number }): Promise<SettleResult> {
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, p.orderId)).for("update");
    const [payment] = await tx.select().from(schema.payments).where(eq(schema.payments.id, p.paymentId));
    if (!order || !payment) return "stale" as const;
    if (payment.state === p.toState) return "already" as const;
    if (payment.state !== p.fromState) return "stale" as const;
    if (order.status === "cancelled" || order.status === "rejected") return "closed" as const;
    if (order.paymentStatus === "paid") return "order-paid" as const;
    await tx.update(schema.payments).set({ state: p.toState, performTime: new Date() }).where(eq(schema.payments.id, payment.id));
    await tx.update(schema.orders).set({ paymentStatus: "paid", updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
    await tx.insert(schema.orderEvents).values({
      orderId: order.id,
      type: "payment",
      message: `${LABEL[p.provider]} orqali ${formatUZS(payment.amount)} to‘landi`,
      code: "payment_paid",
      params: { provider: LABEL[p.provider], amount: payment.amount },
      actor: p.provider,
      isPublic: true,
    });
    return "paid" as const;
  });
  if (result === "paid") await announcePaid(p.orderId);
  return result;
}

async function announcePaid(orderId: string) {
  const db = await getDb();
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!order) return;
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  await notifyOrder({ ...order, items }, "💳 To‘lov qabul qilindi").catch(() => {});
  await notifyCustomerTelegram(orderId, "payment");
}

/**
 * Records a cancelled, failed or refunded payment. A failed or cancelled attempt never overrides an order
 * that is already paid (another transaction may have paid it).
 */
export async function markOrderPaymentCancelled(orderId: string, provider: ProviderId, status: "cancelled" | "failed" | "refunded", message: string) {
  const db = await getDb();
  const res = await db
    .update(schema.orders)
    .set({ paymentStatus: status, updatedAt: new Date() })
    .where(and(eq(schema.orders.id, orderId), status === "refunded" ? sql`TRUE` : notInArray(schema.orders.paymentStatus, ["paid", "refund_requested", "refunded"])))
    .returning({ id: schema.orders.id });
  if (!res.length) return;
  await db.insert(schema.orderEvents).values({
    orderId,
    type: "payment",
    message,
    code: `payment_${status}`,
    params: { provider: LABEL[provider] },
    actor: provider,
    isPublic: true,
  });
  await notifyCustomerTelegram(orderId, "payment");
}
