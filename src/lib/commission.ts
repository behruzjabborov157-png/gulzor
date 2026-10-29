import { and, asc, desc, eq, isNull, lte, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { audit, type AuditActor } from "@/lib/florists";

/*
 * Commission billing. Customers pay marketplace shops directly, so each month Gulzor issues every shop a
 * statement of the commission on its delivered orders, and records when the shop has paid it.
 * - An order is billed once: issuing links it to the statement (orders.commission_statement_id).
 * - A statement for month M takes every delivered, not yet billed order with a delivery date up to the end of M,
 *   so an order delivered late is picked up by the next statement instead of being lost.
 * - Only finished months can be billed. Gulzor's own shop is never billed.
 */

const TASHKENT_OFFSET_MS = 5 * 3_600_000;

/** "YYYY-MM" of the current month in Tashkent. */
export function currentPeriod(now = new Date()) {
  return new Date(now.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 7);
}

export function addMonths(period: string, n: number) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Last calendar day of a period, "YYYY-MM-DD". */
export function periodEnd(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export const isPeriod = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Delivered orders not billed yet, per marketplace shop. */
export async function unbilledByFlorist(floristId?: number) {
  const db = await getDb();
  const where: SQL[] = [eq(schema.orders.status, "delivered"), isNull(schema.orders.commissionStatementId), eq(schema.florists.isPlatform, false)];
  if (floristId) where.push(eq(schema.orders.floristId, floristId));
  return db
    .select({
      floristId: schema.florists.id,
      name: schema.florists.name,
      orders: sql<number>`count(*)::int`,
      goods: sql<number>`coalesce(sum(${schema.orders.subtotal} - ${schema.orders.discount}), 0)::int`,
      commission: sql<number>`coalesce(sum(${schema.orders.commissionAmount}), 0)::int`,
    })
    .from(schema.orders)
    .innerJoin(schema.florists, eq(schema.florists.id, schema.orders.floristId))
    .where(and(...where))
    .groupBy(schema.florists.id, schema.florists.name)
    .orderBy(asc(schema.florists.name));
}

export type IssuedStatement = { id: number; floristId: number; period: string; orderCount: number; commissionTotal: number };
export type IssueResult = { ok: true; issued: IssuedStatement[] } | { ok: false; message: string };

/** Issues the statements for one finished month. Safe to run twice: already billed orders are never billed again. */
export async function issueStatements(actor: AuditActor, period: string, now = new Date()): Promise<IssueResult> {
  if (!isPeriod(period)) return { ok: false, message: "Oyni tanlang" };
  if (period >= currentPeriod(now)) return { ok: false, message: "Faqat tugagan oy uchun hisob chiqariladi" };
  const end = periodEnd(period);
  const db = await getDb();
  const shops = await db.select({ id: schema.florists.id }).from(schema.florists).where(eq(schema.florists.isPlatform, false));
  const issued: IssuedStatement[] = [];
  for (const shop of shops) {
    const row = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: schema.commissionStatements.id })
        .from(schema.commissionStatements)
        .where(and(eq(schema.commissionStatements.floristId, shop.id), eq(schema.commissionStatements.period, period)));
      if (existing) return null;
      const orders = await tx
        .select({ id: schema.orders.id, goods: sql<number>`${schema.orders.subtotal} - ${schema.orders.discount}`, commission: schema.orders.commissionAmount })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.floristId, shop.id),
            eq(schema.orders.status, "delivered"),
            isNull(schema.orders.commissionStatementId),
            lte(schema.orders.deliveryDate, end),
          ),
        )
        .for("update");
      if (!orders.length) return null;
      const [st] = await tx
        .insert(schema.commissionStatements)
        .values({
          floristId: shop.id,
          period,
          orderCount: orders.length,
          goodsTotal: orders.reduce((s, o) => s + Number(o.goods), 0),
          commissionTotal: orders.reduce((s, o) => s + o.commission, 0),
        })
        .returning();
      for (const o of orders) {
        await tx.update(schema.orders).set({ commissionStatementId: st.id }).where(eq(schema.orders.id, o.id));
      }
      return st;
    });
    if (row) {
      issued.push({ id: row.id, floristId: row.floristId, period: row.period, orderCount: row.orderCount, commissionTotal: row.commissionTotal });
      await audit(actor, "commission.issued", "florist", row.floristId, { period, statementId: row.id, orders: row.orderCount, commission: row.commissionTotal });
    }
  }
  return { ok: true, issued };
}

export async function setStatementPaid(actor: AuditActor, id: number, paid: boolean, note = ""): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = await getDb();
  const [st] = await db.select().from(schema.commissionStatements).where(eq(schema.commissionStatements.id, id));
  if (!st) return { ok: false, message: "Hisob topilmadi" };
  if ((st.status === "paid") === paid) return { ok: true };
  await db
    .update(schema.commissionStatements)
    .set(paid ? { status: "paid", paidAt: new Date(), paidNote: note.trim().slice(0, 300) } : { status: "unpaid", paidAt: null, paidNote: "" })
    .where(eq(schema.commissionStatements.id, id));
  await audit(actor, paid ? "commission.paid" : "commission.unpaid", "florist", st.floristId, {
    period: st.period,
    statementId: id,
    commission: st.commissionTotal,
    ...(paid && note.trim() ? { note: note.trim().slice(0, 300) } : {}),
  });
  return { ok: true };
}

export async function listStatements(opts: { floristId?: number; status?: "paid" | "unpaid"; limit?: number } = {}) {
  const db = await getDb();
  const where: SQL[] = [];
  if (opts.floristId) where.push(eq(schema.commissionStatements.floristId, opts.floristId));
  if (opts.status) where.push(eq(schema.commissionStatements.status, opts.status));
  return db
    .select({ s: schema.commissionStatements, florist: schema.florists.name })
    .from(schema.commissionStatements)
    .innerJoin(schema.florists, eq(schema.florists.id, schema.commissionStatements.floristId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.commissionStatements.period), asc(schema.florists.name))
    .limit(opts.limit ?? 200);
}

/** Orders on a statement; with floristId, only when the statement belongs to that florist. */
export async function statementOrders(statementId: number, floristId?: number) {
  const db = await getDb();
  const where: SQL[] = [eq(schema.orders.commissionStatementId, statementId)];
  if (floristId) where.push(eq(schema.orders.floristId, floristId));
  return db
    .select({
      id: schema.orders.id,
      number: schema.orders.number,
      deliveryDate: schema.orders.deliveryDate,
      goods: sql<number>`${schema.orders.subtotal} - ${schema.orders.discount}`,
      commissionRate: schema.orders.commissionRate,
      commissionAmount: schema.orders.commissionAmount,
    })
    .from(schema.orders)
    .where(and(...where))
    .orderBy(asc(schema.orders.deliveryDate), asc(schema.orders.number));
}
