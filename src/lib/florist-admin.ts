import { and, count, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { audit, type AuditActor, type FloristStatus } from "@/lib/florists";
import { formatUZS } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/orders";

/*
 * Gulzor staff managing the shops on the marketplace: moderation (approve / suspend / reject),
 * commission rates and the audit log. Every change is written to audit_logs.
 */

export const FLORIST_STATUS_LABEL: Record<FloristStatus, string> = {
  pending: "Ko‘rib chiqilmoqda",
  approved: "Tasdiqlangan",
  suspended: "To‘xtatilgan",
  rejected: "Rad etilgan",
};

export const FLORIST_STATUS_STYLE: Record<FloristStatus, string> = {
  pending: "bg-petal text-charcoal",
  approved: "bg-sage-light text-wine",
  suspended: "bg-danger/10 text-danger",
  rejected: "bg-charcoal/10 text-muted",
};

/** Allowed moderation steps. A rejected application can be reconsidered; a suspended shop can be reinstated. */
export const FLORIST_STATUS_TRANSITIONS: Record<FloristStatus, FloristStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["suspended"],
  suspended: ["approved", "rejected"],
  rejected: ["approved"],
};

/** Statuses that need a reason the florist will see in its panel. */
export const NEEDS_REASON: FloristStatus[] = ["suspended", "rejected"];

/** Highest commission the admin can set, in basis points (50%). */
export const MAX_COMMISSION_BP = 5000;

export type AdminResult = { ok: true } | { ok: false; message: string };

export async function listFloristsForAdmin(status?: FloristStatus) {
  const db = await getDb();
  const where: SQL[] = [];
  if (status) where.push(eq(schema.florists.status, status));
  const rows = await db
    .select({ f: schema.florists, city: schema.deliveryRegions.name })
    .from(schema.florists)
    .leftJoin(schema.deliveryRegions, eq(schema.deliveryRegions.id, schema.florists.regionId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.florists.isPlatform), desc(schema.florists.createdAt));
  const ids = rows.map((r) => r.f.id);
  const [products, orders] = ids.length
    ? await Promise.all([
        db
          .select({ id: schema.products.floristId, n: count() })
          .from(schema.products)
          .where(and(inArray(schema.products.floristId, ids), eq(schema.products.status, "active"), eq(schema.products.isAddon, false)))
          .groupBy(schema.products.floristId),
        db
          .select({ id: schema.orders.floristId, n: count() })
          .from(schema.orders)
          .where(inArray(schema.orders.floristId, ids))
          .groupBy(schema.orders.floristId),
      ])
    : [[], []];
  const p = new Map(products.map((r) => [r.id, r.n]));
  const o = new Map(orders.map((r) => [r.id, r.n]));
  return rows.map((r) => ({ ...r.f, city: r.city, products: p.get(r.f.id) ?? 0, orders: o.get(r.f.id) ?? 0 }));
}

/** Number of shops per status (tabs and the admin menu badge). */
export async function floristStatusCounts() {
  const db = await getDb();
  const rows = await db.select({ status: schema.florists.status, n: count() }).from(schema.florists).groupBy(schema.florists.status);
  const out: Record<FloristStatus, number> = { pending: 0, approved: 0, suspended: 0, rejected: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export async function floristAdminDetail(id: number) {
  const db = await getDb();
  const [row] = await db
    .select({ f: schema.florists, city: schema.deliveryRegions.name })
    .from(schema.florists)
    .leftJoin(schema.deliveryRegions, eq(schema.deliveryRegions.id, schema.florists.regionId))
    .where(eq(schema.florists.id, id));
  if (!row) return null;
  // Start of the current month in Tashkent (UTC+5, no DST).
  const local = new Date(Date.now() + 5 * 3_600_000);
  const monthStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 5 * 3_600_000);
  const [users, [products], [zones], [orders], log] = await Promise.all([
    db
      .select({ email: schema.adminUsers.email, name: schema.adminUsers.name, isActive: schema.adminUsers.isActive, lastLoginAt: schema.adminUsers.lastLoginAt })
      .from(schema.adminUsers)
      .where(eq(schema.adminUsers.floristId, id)),
    db
      .select({
        active: sql<number>`count(*) filter (where ${schema.products.status} = 'active')::int`,
        all: count(),
      })
      .from(schema.products)
      .where(and(eq(schema.products.floristId, id), eq(schema.products.isAddon, false))),
    db
      .select({ active: sql<number>`count(*) filter (where ${schema.deliveryZones.isActive})::int`, all: count() })
      .from(schema.deliveryZones)
      .where(eq(schema.deliveryZones.floristId, id)),
    db
      .select({
        all: count(),
        open: sql<number>`count(*) filter (where ${schema.orders.status} not in ('delivered','cancelled','rejected'))::int`,
        delivered: sql<number>`count(*) filter (where ${schema.orders.status} = 'delivered')::int`,
        commission: sql<number>`coalesce(sum(${schema.orders.commissionAmount}) filter (where ${schema.orders.status} = 'delivered'), 0)::bigint`,
        commissionMonth: sql<number>`coalesce(sum(${schema.orders.commissionAmount}) filter (where ${schema.orders.status} = 'delivered' and ${schema.orders.createdAt} >= ${monthStart.toISOString()}::timestamptz), 0)::bigint`,
      })
      .from(schema.orders)
      .where(eq(schema.orders.floristId, id)),
    auditEntries({ entity: "florist", entityId: String(id), limit: 30 }),
  ]);
  return {
    ...row.f,
    city: row.city,
    users,
    stats: {
      products,
      zones,
      orders: { ...orders, commission: Number(orders.commission), commissionMonth: Number(orders.commissionMonth) },
    },
    log,
  };
}

export async function setFloristStatus(actor: AuditActor, id: number, to: FloristStatus, reason = ""): Promise<AdminResult> {
  const why = reason.trim().slice(0, 300);
  if (NEEDS_REASON.includes(to) && why.length < 3) return { ok: false, message: "Sababini yozing — florist uni panelida ko‘radi" };
  const db = await getDb();
  const [f] = await db.select().from(schema.florists).where(eq(schema.florists.id, id));
  if (!f) return { ok: false, message: "Do‘kon topilmadi" };
  if (f.isPlatform) return { ok: false, message: "Gulzor’ning o‘z do‘koni holatini o‘zgartirib bo‘lmaydi" };
  if (!FLORIST_STATUS_TRANSITIONS[f.status].includes(to)) {
    return { ok: false, message: `«${FLORIST_STATUS_LABEL[f.status]}» holatidan «${FLORIST_STATUS_LABEL[to]}» holatiga o‘tib bo‘lmaydi` };
  }
  // Guarded update: a parallel moderation click cannot apply a step from a stale status.
  const updated = await db
    .update(schema.florists)
    .set({
      status: to,
      statusReason: to === "approved" ? null : why,
      approvedAt: to === "approved" ? (f.approvedAt ?? new Date()) : f.approvedAt,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.florists.id, id), eq(schema.florists.status, f.status)))
    .returning({ id: schema.florists.id });
  if (!updated.length) return { ok: false, message: "Holat boshqa admin tomonidan o‘zgartirilgan. Sahifani yangilang." };
  await audit(actor, `florist.${to}`, "florist", id, { from: f.status, to, ...(why && to !== "approved" ? { reason: why } : {}) });
  return { ok: true };
}

/** Commission as a percentage string ("12", "7.5") → basis points; applies to orders placed from now on. */
export async function setFloristCommission(actor: AuditActor, id: number, percent: string): Promise<AdminResult> {
  const value = Number(percent.replace(",", ".").trim());
  if (!percent.trim() || !Number.isFinite(value)) return { ok: false, message: "Foizni raqam bilan kiriting" };
  const bp = Math.round(value * 100);
  if (bp < 0 || bp > MAX_COMMISSION_BP) return { ok: false, message: `Komissiya 0–${MAX_COMMISSION_BP / 100}% oralig‘ida bo‘lishi kerak` };
  const db = await getDb();
  const [f] = await db.select({ rate: schema.florists.commissionRate }).from(schema.florists).where(eq(schema.florists.id, id));
  if (!f) return { ok: false, message: "Do‘kon topilmadi" };
  if (f.rate === bp) return { ok: true };
  await db.update(schema.florists).set({ commissionRate: bp, updatedAt: new Date() }).where(eq(schema.florists.id, id));
  await audit(actor, "florist.commission", "florist", id, { from: f.rate, to: bp });
  return { ok: true };
}

export type AuditEntry = typeof schema.auditLogs.$inferSelect;

export async function auditEntries(opts: { entity?: string; entityId?: string; limit?: number; offset?: number } = {}) {
  const db = await getDb();
  const where: SQL[] = [];
  if (opts.entity) where.push(eq(schema.auditLogs.entity, opts.entity));
  if (opts.entityId) where.push(eq(schema.auditLogs.entityId, opts.entityId));
  return db
    .select()
    .from(schema.auditLogs)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.auditLogs.createdAt), desc(schema.auditLogs.id))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

export async function auditCount(entity?: string) {
  const db = await getDb();
  const [r] = await db
    .select({ n: count() })
    .from(schema.auditLogs)
    .where(entity ? eq(schema.auditLogs.entity, entity) : undefined);
  return r.n;
}

/** Human-readable line for an audit entry. */
export function describeAudit(e: AuditEntry): string {
  const d = e.data as Record<string, unknown>;
  const pct = (bp: unknown) => `${(Number(bp) / 100).toLocaleString("uz-UZ")}%`;
  const reason = d.reason ? ` — ${String(d.reason)}` : "";
  switch (e.action) {
    case "florist.approved":
      return `Do‘kon tasdiqlandi${d.from ? ` (avval: ${FLORIST_STATUS_LABEL[d.from as FloristStatus] ?? d.from})` : ""}`;
    case "florist.suspended":
      return `Do‘kon to‘xtatildi${reason}`;
    case "florist.rejected":
      return `Ariza rad etildi${reason}`;
    case "florist.commission":
      return `Komissiya: ${pct(d.from)} → ${pct(d.to)}`;
    case "florist.profile":
      return "Do‘kon profili tahrirlandi";
    case "florist.registered":
      return "Do‘kon arizasi yuborildi";
    case "commission.issued":
      return `${String(d.period)} komissiya hisobi: ${String(d.orders)} ta buyurtma, ${formatUZS(Number(d.commission))}`;
    case "commission.paid":
      return `${String(d.period)} komissiyasi to‘landi (${formatUZS(Number(d.commission))})${d.note ? ` — ${String(d.note)}` : ""}`;
    case "commission.unpaid":
      return `${String(d.period)} komissiyasi «to‘lanmagan»ga qaytarildi`;
    case "order.status":
      return `Buyurtma ${String(d.number ?? "")} holati: ${ORDER_STATUS_LABEL[d.to as keyof typeof ORDER_STATUS_LABEL] ?? String(d.to)}${reason}`;
    case "order.payment":
      return `Buyurtma ${String(d.number ?? "")} to‘lov holati: ${PAYMENT_STATUS_LABEL[d.to as keyof typeof PAYMENT_STATUS_LABEL] ?? String(d.to)}`;
    default:
      return e.action;
  }
}

/** Shops for filters (admin orders list). */
export async function floristOptions() {
  const db = await getDb();
  return db
    .select({ id: schema.florists.id, name: schema.florists.name, status: schema.florists.status })
    .from(schema.florists)
    .where(ne(schema.florists.status, "rejected"))
    .orderBy(desc(schema.florists.isPlatform), schema.florists.name);
}
