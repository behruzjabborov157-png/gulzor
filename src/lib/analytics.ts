import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addDaysISO, tashkentNow } from "@/lib/time";

const { orders: o, orderItems: oi, products: p } = schema;
const notCancelled = sql`${o.status} NOT IN ('cancelled', 'rejected')`;
/** Order date in Tashkent local time (UTC+5). */
const localDate = sql<string>`to_char((${o.createdAt} AT TIME ZONE 'UTC') + interval '5 hours', 'YYYY-MM-DD')`;

export async function dashboardStats(days: number) {
  const db = await getDb();
  const today = tashkentNow().date;
  const fromDate = addDaysISO(today, -(days - 1));
  const since = new Date(`${fromDate}T00:00:00+05:00`);

  const [totals] = await db
    .select({
      orders: sql<number>`count(*) FILTER (WHERE ${notCancelled})::int`,
      revenue: sql<number>`coalesce(sum(${o.total}) FILTER (WHERE ${notCancelled}), 0)::bigint`,
      paid: sql<number>`coalesce(sum(${o.total}) FILTER (WHERE ${o.paymentStatus} = 'paid'), 0)::bigint`,
      cancelled: sql<number>`count(*) FILTER (WHERE ${o.status} IN ('cancelled', 'rejected'))::int`,
      all: sql<number>`count(*)::int`,
    })
    .from(o)
    .where(gte(o.createdAt, since));

  const byDate = await db
    .select({ date: localDate, revenue: sql<number>`coalesce(sum(${o.total}), 0)::bigint`, orders: sql<number>`count(*)::int` })
    .from(o)
    .where(and(gte(o.createdAt, since), notCancelled))
    .groupBy(localDate);

  const series = Array.from({ length: days }, (_, i) => {
    const d = addDaysISO(fromDate, i);
    const row = byDate.find((r) => r.date === d);
    return { date: d, revenue: Number(row?.revenue ?? 0), orders: row?.orders ?? 0 };
  });

  const bestsellers = await db
    .select({
      productId: oi.productId,
      name: oi.productName,
      quantity: sql<number>`sum(${oi.quantity})::int`,
      revenue: sql<number>`sum(${oi.lineTotal})::bigint`,
    })
    .from(oi)
    .innerJoin(o, eq(o.id, oi.orderId))
    .where(and(gte(o.createdAt, since), notCancelled))
    .groupBy(oi.productId, oi.productName)
    .orderBy(desc(sql`sum(${oi.quantity})`))
    .limit(8);

  const lowStock = await db
    .select({ id: p.id, name: p.name, stock: p.stockQuantity, availability: p.availability })
    .from(p)
    .where(and(eq(p.status, "active"), isNotNull(p.stockQuantity), lte(p.stockQuantity, 5)))
    .orderBy(p.stockQuantity)
    .limit(10);

  const [{ outOfStock }] = await db
    .select({ outOfStock: sql<number>`count(*)::int` })
    .from(p)
    .where(and(eq(p.status, "active"), sql`(${p.availability} = 'out_of_stock' OR ${p.stockQuantity} = 0)`));

  const [{ awaiting }] = await db.select({ awaiting: sql<number>`count(*)::int` }).from(o).where(eq(o.status, "new"));

  const revenue = Number(totals.revenue);
  return {
    fromDate,
    today,
    orders: totals.orders,
    revenue,
    paid: Number(totals.paid),
    cancelled: totals.cancelled,
    cancelRate: totals.all ? totals.cancelled / totals.all : 0,
    aov: totals.orders ? Math.round(revenue / totals.orders) : 0,
    series,
    bestsellers: bestsellers.map((b) => ({ ...b, revenue: Number(b.revenue) })),
    lowStock,
    outOfStock,
    awaiting,
  };
}
