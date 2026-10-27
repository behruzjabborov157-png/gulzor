import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { formatUZS } from "@/lib/format";
import { notifyOrder } from "@/lib/telegram";

/** Called only from verified server-to-server provider callbacks. */
export async function markOrderPaid(orderId: string, provider: "payme" | "click", amount: number) {
  const db = await getDb();
  const [order] = await db
    .update(schema.orders)
    .set({ paymentStatus: "paid", updatedAt: new Date() })
    .where(eq(schema.orders.id, orderId))
    .returning();
  await db.insert(schema.orderEvents).values({
    orderId,
    type: "payment",
    message: `${provider === "payme" ? "Payme" : "Click"} orqali ${formatUZS(amount)} to‘landi`,
    actor: provider,
    isPublic: true,
  });
  if (order) {
    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    await notifyOrder({ ...order, items }, "💳 To‘lov qabul qilindi").catch(() => {});
  }
}

export async function markOrderPaymentCancelled(
  orderId: string,
  provider: "payme" | "click",
  status: "cancelled" | "failed" | "refunded",
  message: string,
) {
  const db = await getDb();
  await db.update(schema.orders).set({ paymentStatus: status, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
  await db.insert(schema.orderEvents).values({ orderId, type: "payment", message, actor: provider, isPublic: true });
}
