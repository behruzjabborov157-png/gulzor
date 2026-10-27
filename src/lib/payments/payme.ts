/**
 * Payme (Paycom) Merchant API — JSON-RPC endpoint that Payme calls server-to-server.
 * Docs: https://developer.help.paycom.uz/  (methods CheckPerformTransaction,
 * CreateTransaction, PerformTransaction, CancelTransaction, CheckTransaction, GetStatement).
 *
 * The order is identified by the account field "order_id" (our order number).
 * Amounts from Payme are in tiyin (1 so'm = 100 tiyin).
 *
 * NOTE: This must be verified in Payme's sandbox with real merchant credentials
 * before being enabled for customers.
 */
import { timingSafeEqual } from "node:crypto";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { paymeCredentials } from "./config";
import { markOrderPaid, markOrderPaymentCancelled } from "./status";

const TIMEOUT_MS = 12 * 3600_000;

type RpcError = { code: number; message: { uz: string; ru: string; en: string }; data?: string };
class PaymeError extends Error {
  constructor(public rpc: RpcError) {
    super(rpc.message.en);
  }
}
const err = (code: number, uz: string, ru: string, en: string, data?: string) => new PaymeError({ code, message: { uz, ru, en }, data });

const E = {
  auth: () => err(-32504, "Ruxsat yo‘q", "Недостаточно привилегий", "Insufficient privileges"),
  method: () => err(-32601, "Metod topilmadi", "Метод не найден", "Method not found"),
  parse: () => err(-32700, "So‘rov xato", "Ошибка разбора JSON", "Parse error"),
  amount: () => err(-31001, "Noto‘g‘ri summa", "Неверная сумма", "Incorrect amount"),
  order: () => err(-31050, "Buyurtma topilmadi", "Заказ не найден", "Order not found", "order_id"),
  orderState: () => err(-31051, "Buyurtmani to‘lab bo‘lmaydi", "Заказ нельзя оплатить", "Order cannot be paid", "order_id"),
  busy: () => err(-31052, "Buyurtma uchun boshqa tranzaksiya mavjud", "Заказ ожидает оплаты другой транзакцией", "Order has another pending transaction", "order_id"),
  txNotFound: () => err(-31003, "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found"),
  cannotPerform: () => err(-31008, "Amalni bajarib bo‘lmaydi", "Невозможно выполнить операцию", "Unable to perform operation"),
  cannotCancel: () => err(-31007, "Buyurtma bajarilgan, bekor qilib bo‘lmaydi", "Заказ выполнен, отмена невозможна", "Order completed, cannot cancel"),
};

function checkAuth(header: string | null): boolean {
  const creds = paymeCredentials();
  if (!creds || !header?.startsWith("Basic ")) return false;
  const expected = Buffer.from(`Paycom:${creds.key}`).toString("base64");
  const got = header.slice(6).trim();
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function findPayableOrder(account: unknown, amountTiyin: unknown) {
  const number = (account as { order_id?: unknown } | null)?.order_id;
  if (typeof number !== "string") throw E.order();
  const db = await getDb();
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.number, number));
  if (!order || order.paymentMethod !== "payme") throw E.order();
  if (order.status === "cancelled" || order.status === "rejected" || order.paymentStatus === "paid" || order.paymentStatus === "refunded") {
    throw E.orderState();
  }
  if (typeof amountTiyin !== "number" || amountTiyin !== order.total * 100) throw E.amount();
  return order;
}

type Tx = typeof schema.payments.$inferSelect;
const ms = (d: Date | null) => (d ? d.getTime() : 0);
const view = (t: Tx) => ({
  create_time: ms(t.createTime),
  perform_time: ms(t.performTime),
  cancel_time: ms(t.cancelTime),
  transaction: String(t.id),
  state: t.state,
  reason: t.reason,
});

async function findTx(id: unknown) {
  if (typeof id !== "string") throw E.txNotFound();
  const db = await getDb();
  const [t] = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.provider, "payme"), eq(schema.payments.providerTransactionId, id)));
  return t ?? null;
}

async function cancelTx(t: Tx, reason: number, state: -1 | -2) {
  const db = await getDb();
  const [u] = await db
    .update(schema.payments)
    .set({ state, reason, cancelTime: new Date() })
    .where(eq(schema.payments.id, t.id))
    .returning();
  await markOrderPaymentCancelled(t.orderId, "payme", state === -2 ? "refunded" : "cancelled", `Payme: bekor qilindi (sabab ${reason})`);
  return u;
}

async function handle(method: string, params: Record<string, unknown>) {
  const db = await getDb();
  switch (method) {
    case "CheckPerformTransaction": {
      await findPayableOrder(params.account, params.amount);
      return { allow: true };
    }
    case "CreateTransaction": {
      const existing = await findTx(params.id);
      if (existing) {
        if (existing.state !== 1) throw E.cannotPerform();
        if (Date.now() - existing.createTime.getTime() > TIMEOUT_MS) {
          await cancelTx(existing, 4, -1);
          throw E.cannotPerform();
        }
        return { create_time: ms(existing.createTime), transaction: String(existing.id), state: existing.state };
      }
      const order = await findPayableOrder(params.account, params.amount);
      const [pending] = await db
        .select()
        .from(schema.payments)
        .where(and(eq(schema.payments.orderId, order.id), eq(schema.payments.provider, "payme"), eq(schema.payments.state, 1)));
      if (pending) throw E.busy();
      const [t] = await db
        .insert(schema.payments)
        .values({
          orderId: order.id,
          provider: "payme",
          providerTransactionId: String(params.id),
          amount: order.total,
          state: 1,
          providerCreateTime: String(params.time ?? ""),
          raw: params,
        })
        .returning();
      return { create_time: ms(t.createTime), transaction: String(t.id), state: 1 };
    }
    case "PerformTransaction": {
      const t = await findTx(params.id);
      if (!t) throw E.txNotFound();
      if (t.state === 2) return { transaction: String(t.id), perform_time: ms(t.performTime), state: 2 };
      if (t.state !== 1) throw E.cannotPerform();
      if (Date.now() - t.createTime.getTime() > TIMEOUT_MS) {
        await cancelTx(t, 4, -1);
        throw E.cannotPerform();
      }
      const [u] = await db.update(schema.payments).set({ state: 2, performTime: new Date() }).where(eq(schema.payments.id, t.id)).returning();
      await markOrderPaid(t.orderId, "payme", u.amount);
      return { transaction: String(u.id), perform_time: ms(u.performTime), state: 2 };
    }
    case "CancelTransaction": {
      const t = await findTx(params.id);
      if (!t) throw E.txNotFound();
      const reason = typeof params.reason === "number" ? params.reason : 0;
      if (t.state === 1) {
        const u = await cancelTx(t, reason, -1);
        return { transaction: String(u.id), cancel_time: ms(u.cancelTime), state: u.state };
      }
      if (t.state === 2) {
        const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, t.orderId));
        if (order?.status === "delivered") throw E.cannotCancel();
        const u = await cancelTx(t, reason, -2);
        return { transaction: String(u.id), cancel_time: ms(u.cancelTime), state: u.state };
      }
      return { transaction: String(t.id), cancel_time: ms(t.cancelTime), state: t.state };
    }
    case "CheckTransaction": {
      const t = await findTx(params.id);
      if (!t) throw E.txNotFound();
      return view(t);
    }
    case "GetStatement": {
      const from = new Date(Number(params.from));
      const to = new Date(Number(params.to));
      const rows = await db
        .select({ t: schema.payments, number: schema.orders.number })
        .from(schema.payments)
        .innerJoin(schema.orders, eq(schema.orders.id, schema.payments.orderId))
        .where(and(eq(schema.payments.provider, "payme"), gte(schema.payments.createTime, from), lte(schema.payments.createTime, to)));
      return {
        transactions: rows.map(({ t, number }) => ({
          id: t.providerTransactionId,
          time: Number(t.providerCreateTime) || ms(t.createTime),
          amount: t.amount * 100,
          account: { order_id: number },
          ...view(t),
        })),
      };
    }
    default:
      throw E.method();
  }
}

/** Entry point used by the route handler. Always returns HTTP 200 with a JSON-RPC body (per Payme spec). */
export async function paymeRpc(authHeader: string | null, body: string) {
  let id: unknown = null;
  try {
    if (!checkAuth(authHeader)) throw E.auth();
    let req: { id?: unknown; method?: unknown; params?: unknown };
    try {
      req = JSON.parse(body);
    } catch {
      throw E.parse();
    }
    id = req.id ?? null;
    if (typeof req.method !== "string") throw E.method();
    const result = await handle(req.method, (req.params ?? {}) as Record<string, unknown>);
    return { jsonrpc: "2.0", id, result };
  } catch (e) {
    if (e instanceof PaymeError) return { jsonrpc: "2.0", id, error: e.rpc };
    console.error("Payme handler error", e);
    return { jsonrpc: "2.0", id, error: { code: -32400, message: { uz: "Tizim xatosi", ru: "Системная ошибка", en: "System error" } } };
  }
}

/** Customer redirect URL to Payme checkout. */
export function paymeCheckoutUrl(orderNumber: string, total: number, returnUrl: string): string | null {
  const creds = paymeCredentials();
  if (!creds) return null;
  const params = `m=${creds.merchantId};ac.order_id=${orderNumber};a=${total * 100};c=${returnUrl}`;
  return `${creds.checkoutUrl}/${Buffer.from(params).toString("base64")}`;
}
