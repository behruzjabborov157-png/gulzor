import { and, asc, desc, eq, inArray, sql, type AnyColumn } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { pick, type Locale } from "@/i18n/config";

/*
 * Marketplace rules shared by the storefront, checkout, bot and admin.
 * - Only products of "approved" florists are visible and orderable.
 * - One florist per order; the florist delivers it (its own zones) and is paid by the customer.
 * - Gulzor's commission is a percentage of the goods (after discount, without delivery and service fee),
 *   fixed on the order when it is placed.
 */

export type FloristStatus = "pending" | "approved" | "suspended" | "rejected";

/** SQL condition: the row's florist is approved (use on products.florist_id or delivery_zones.florist_id). */
export function floristApproved(column: AnyColumn) {
  return sql`${column} IN (SELECT ${schema.florists.id} FROM ${schema.florists} WHERE ${schema.florists.status} = 'approved')`;
}

/** Commission in so'm for an amount, rate in basis points (1000 = 10%). Rounded to whole so'm. */
export function commissionFor(rateBp: number, amount: number) {
  if (!Number.isInteger(rateBp) || rateBp <= 0 || amount <= 0) return 0;
  return Math.round((amount * rateBp) / 10_000);
}

/** The platform's own shop that owns the original catalogue and anything created by Gulzor staff. */
export async function platformFloristId(): Promise<number> {
  const db = await getDb();
  const [f] = await db.select({ id: schema.florists.id }).from(schema.florists).where(eq(schema.florists.isPlatform, true)).limit(1);
  if (f) return f.id;
  const [created] = await db
    .insert(schema.florists)
    .values({ slug: "gulzor", name: "Gulzor", status: "approved", isPlatform: true, commissionRate: 0, approvedAt: new Date() })
    .onConflictDoNothing()
    .returning({ id: schema.florists.id });
  if (created) return created.id;
  const [again] = await db.select({ id: schema.florists.id }).from(schema.florists).where(eq(schema.florists.slug, "gulzor"));
  return again.id;
}

export type AuditActor = { id: string | null; email: string };

/** Appends an entry to the audit log. Never throws (an audit failure must not undo the action). */
export async function audit(actor: AuditActor, action: string, entity: string, entityId: string | number, data: Record<string, unknown> = {}) {
  try {
    const db = await getDb();
    await db.insert(schema.auditLogs).values({ actorId: actor.id, actorEmail: actor.email, action, entity, entityId: String(entityId), data });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

/* ------------------------------------------------------------------ */
/* Public florist profiles (approved shops only)                       */
/* ------------------------------------------------------------------ */

export type PublicFlorist = {
  id: number;
  slug: string;
  name: string;
  description: string;
  address: string;
  /** Legal seller name (YaTT / MChJ) — shown to customers as the seller. The tax id stays private. */
  legalName: string;
  phone: string;
  telegramUsername: string;
  logoUrl: string | null;
  city: string | null;
  isPlatform: boolean;
  productCount: number;
  approvedAt: Date | null;
};

function publicFlorist(
  f: typeof schema.florists.$inferSelect,
  locale: Locale,
  city: { name: string; nameRu: string | null } | null,
  productCount: number,
): PublicFlorist {
  return {
    id: f.id,
    slug: f.slug,
    name: pick(locale, f.name, f.nameRu),
    description: pick(locale, f.description, f.descriptionRu),
    address: pick(locale, f.address, f.addressRu),
    legalName: f.legalName,
    phone: f.phone,
    telegramUsername: f.telegramUsername,
    logoUrl: f.logoUrl,
    city: city ? pick(locale, city.name, city.nameRu) : null,
    isPlatform: f.isPlatform,
    productCount,
    approvedAt: f.approvedAt,
  };
}

/** Number of products on sale per florist. */
async function productCounts(ids: number[]) {
  if (!ids.length) return new Map<number, number>();
  const db = await getDb();
  const rows = await db
    .select({ id: schema.products.floristId, n: sql<number>`count(*)::int` })
    .from(schema.products)
    .where(and(inArray(schema.products.floristId, ids), eq(schema.products.status, "active"), eq(schema.products.isAddon, false)))
    .groupBy(schema.products.floristId);
  return new Map(rows.map((r) => [r.id, r.n]));
}

/** Approved shops, the platform's own shop first, then by name. */
export async function listApprovedFlorists(locale: Locale): Promise<PublicFlorist[]> {
  const db = await getDb();
  const rows = await db
    .select({ f: schema.florists, city: schema.deliveryRegions })
    .from(schema.florists)
    .leftJoin(schema.deliveryRegions, eq(schema.deliveryRegions.id, schema.florists.regionId))
    .where(eq(schema.florists.status, "approved"))
    .orderBy(desc(schema.florists.isPlatform), asc(schema.florists.name));
  const counts = await productCounts(rows.map((r) => r.f.id));
  return rows.map((r) => publicFlorist(r.f, locale, r.city, counts.get(r.f.id) ?? 0));
}

/** One approved shop by its public address, or null (pending, suspended and rejected shops are not public). */
export async function getFloristBySlug(slug: string, locale: Locale): Promise<PublicFlorist | null> {
  const db = await getDb();
  const [r] = await db
    .select({ f: schema.florists, city: schema.deliveryRegions })
    .from(schema.florists)
    .leftJoin(schema.deliveryRegions, eq(schema.deliveryRegions.id, schema.florists.regionId))
    .where(and(eq(schema.florists.slug, slug), eq(schema.florists.status, "approved")));
  if (!r) return null;
  const counts = await productCounts([r.f.id]);
  return publicFlorist(r.f, locale, r.city, counts.get(r.f.id) ?? 0);
}

/** An approved shop by id (product pages), or null. */
export async function getFloristById(id: number, locale: Locale): Promise<PublicFlorist | null> {
  const db = await getDb();
  const [r] = await db
    .select({ f: schema.florists, city: schema.deliveryRegions })
    .from(schema.florists)
    .leftJoin(schema.deliveryRegions, eq(schema.deliveryRegions.id, schema.florists.regionId))
    .where(and(eq(schema.florists.id, id), eq(schema.florists.status, "approved")));
  if (!r) return null;
  const counts = await productCounts([r.f.id]);
  return publicFlorist(r.f, locale, r.city, counts.get(r.f.id) ?? 0);
}
