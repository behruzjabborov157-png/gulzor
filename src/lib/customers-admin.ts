import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { normalizePhone } from "@/lib/format";

/*
 * Customers for the back office: everyone who placed an order (website, Mini App or bot), grouped by phone,
 * plus whether they have a website account. Guests have no account, so the phone is what ties their orders.
 */

const O = schema.orders;
const notClosed = sql`${O.status} NOT IN ('cancelled', 'rejected')`;

export type CustomerRow = {
  phone: string;
  name: string;
  orders: number;
  spent: number;
  lastOrder: Date;
  telegram: boolean;
  locale: string;
  hasAccount: boolean;
};

export async function listCustomers(opts: { q?: string; page: number; perPage: number }) {
  const db = await getDb();
  const q = (opts.q ?? "").trim();
  const where: SQL[] = [];
  if (q) {
    const phone = normalizePhone(q);
    const digits = q.replace(/\D/g, "");
    const conds: SQL[] = [ilike(O.customerName, `%${q}%`)];
    if (phone) conds.push(eq(O.customerPhone, phone));
    else if (digits.length >= 4) conds.push(ilike(O.customerPhone, `%${digits}%`));
    where.push(or(...conds)!);
  }
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        phone: O.customerPhone,
        name: sql<string>`(array_agg(${O.customerName} ORDER BY ${O.createdAt} DESC))[1]`,
        orders: sql<number>`count(*)::int`,
        spent: sql<number>`coalesce(sum(${O.total}) FILTER (WHERE ${notClosed}), 0)::bigint`,
        lastOrder: sql<Date>`max(${O.createdAt})`,
        telegram: sql<boolean>`bool_or(${O.telegramUserId} IS NOT NULL)`,
        locale: sql<string>`(array_agg(${O.locale} ORDER BY ${O.createdAt} DESC))[1]`,
      })
      .from(O)
      .where(cond)
      .groupBy(O.customerPhone)
      .orderBy(desc(sql`max(${O.createdAt})`))
      .limit(opts.perPage)
      .offset((opts.page - 1) * opts.perPage),
    db.select({ n: sql<number>`count(DISTINCT ${O.customerPhone})::int` }).from(O).where(cond),
  ]);
  const phones = rows.map((r) => r.phone);
  const accounts = phones.length ? await db.select({ phone: schema.customers.phone }).from(schema.customers).where(inArray(schema.customers.phone, phones)) : [];
  const withAccount = new Set(accounts.map((a) => a.phone));
  const [{ total: accountsTotal }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.customers);
  return {
    total: n,
    accountsTotal,
    rows: rows.map((r): CustomerRow => ({ ...r, spent: Number(r.spent), lastOrder: new Date(r.lastOrder), hasAccount: withAccount.has(r.phone) })),
  };
}

/** One customer by phone: account (if any), saved addresses and all orders. */
export async function customerDetail(phone: string) {
  const db = await getDb();
  const [account] = await db.select().from(schema.customers).where(eq(schema.customers.phone, phone));
  const [orders, addresses] = await Promise.all([
    db
      .select({ o: O, shop: schema.florists.name })
      .from(O)
      .leftJoin(schema.florists, eq(schema.florists.id, O.floristId))
      .where(eq(O.customerPhone, phone))
      .orderBy(desc(O.createdAt))
      .limit(200),
    account ? db.select().from(schema.customerAddresses).where(eq(schema.customerAddresses.customerId, account.id)) : [],
  ]);
  if (!account && !orders.length) return null;
  const live = orders.filter((r) => r.o.status !== "cancelled" && r.o.status !== "rejected");
  return {
    account: account ? { id: account.id, name: account.name, createdAt: account.createdAt, locale: account.locale } : null,
    name: orders[0]?.o.customerName ?? account?.name ?? "",
    orders: orders.map((r) => ({ ...r.o, shop: r.shop })),
    addresses,
    spent: live.reduce((s, r) => s + r.o.total, 0),
    delivered: orders.filter((r) => r.o.status === "delivered").length,
    telegram: orders.some((r) => r.o.telegramUserId),
  };
}

/** Phones go into URLs as plain digits ("998901234567"). */
export const phoneParam = (phone: string) => phone.replace(/\D/g, "");
export const phoneFromParam = (p: string) => normalizePhone(p);
