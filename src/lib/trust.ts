import { timingSafeEqual } from "node:crypto";
import { and, asc, avg, count, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { audit, type AuditActor } from "@/lib/florists";
import type { Order } from "@/lib/orders";
import { saveImage } from "@/lib/storage";
import { addDaysISO, tashkentNow } from "@/lib/time";

/*
 * Trust features: photos of the prepared bouquet, verified-purchase reviews, customer disputes and the
 * per-shop operational numbers the admin uses to keep the marketplace honest.
 * Customer-facing functions take an order already checked by orderForCustomer (secret link or account).
 */

export type Result = { ok: true } | { ok: false; message: string };

/* ------------------------------------------------------------------ */
/* Customer access                                                     */
/* ------------------------------------------------------------------ */

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The order if the visitor may act on it: the secret link from the confirmation, or the signed-in owner. */
export async function orderForCustomer(number: string, token: string, customerId: string | null) {
  const db = await getDb();
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.number, number));
  if (!o) return null;
  if ((token && sameSecret(token, o.accessToken)) || (customerId && o.customerId === customerId)) return o;
  return null;
}

/* ------------------------------------------------------------------ */
/* Bouquet photos                                                      */
/* ------------------------------------------------------------------ */

export const MAX_ORDER_PHOTOS = 4;
const PHOTO_STATUSES: Order["status"][] = ["confirmed", "preparing", "ready", "dispatched", "delivered"];

/** Adds a photo of the prepared bouquet. floristId (from the session) limits it to that shop's orders. */
export async function addOrderPhoto(orderId: string, file: File, actorEmail: string, floristId: number | null): Promise<Result> {
  const db = await getDb();
  const [o] = await db.select({ status: schema.orders.status, floristId: schema.orders.floristId }).from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!o || (floristId != null && o.floristId !== floristId)) return { ok: false, message: "Buyurtma topilmadi" };
  if (!PHOTO_STATUSES.includes(o.status)) return { ok: false, message: "Rasmni buyurtma qabul qilingandan keyin yuklang" };
  const [{ n }] = await db.select({ n: count() }).from(schema.orderPhotos).where(eq(schema.orderPhotos.orderId, orderId));
  if (n >= MAX_ORDER_PHOTOS) return { ok: false, message: `Ko‘pi bilan ${MAX_ORDER_PHOTOS} ta rasm` };
  const url = await saveImage(file, "orders"); // throws UploadError with a readable message
  await db.insert(schema.orderPhotos).values({ orderId, url, uploadedBy: actorEmail });
  await db.insert(schema.orderEvents).values({ orderId, type: "note", code: "photo", message: "Tayyor guldasta rasmi qo‘shildi", actor: actorEmail, isPublic: true });
  return { ok: true };
}

export async function orderPhotos(orderId: string) {
  const db = await getDb();
  return db.select().from(schema.orderPhotos).where(eq(schema.orderPhotos.orderId, orderId)).orderBy(asc(schema.orderPhotos.createdAt));
}

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

export type ReviewStatus = "pending" | "approved" | "rejected";

export async function reviewForOrder(orderId: string) {
  const db = await getDb();
  const [r] = await db.select().from(schema.reviews).where(eq(schema.reviews.orderId, orderId));
  return r ?? null;
}

/** Only a delivered order can be reviewed, once. The review waits for moderation. */
export async function submitReview(
  o: { id: string; status: Order["status"]; floristId: number; customerName: string },
  input: { rating: number; text: string; locale: string },
): Promise<Result> {
  if (o.status !== "delivered") return { ok: false, message: "notDelivered" };
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return { ok: false, message: "rating" };
  const text = input.text.trim().slice(0, 1000);
  // Public name: the first word of the customer's name only.
  const authorName = o.customerName.trim().split(/\s+/)[0]?.slice(0, 40) || "Mijoz";
  const db = await getDb();
  const inserted = await db
    .insert(schema.reviews)
    .values({ orderId: o.id, floristId: o.floristId, rating: input.rating, text, authorName, locale: input.locale === "ru" ? "ru" : "uz" })
    .onConflictDoNothing()
    .returning({ id: schema.reviews.id });
  if (!inserted.length) return { ok: false, message: "exists" };
  return { ok: true };
}

export async function moderateReview(actor: AuditActor, id: number, status: "approved" | "rejected"): Promise<Result> {
  const db = await getDb();
  const [r] = await db.update(schema.reviews).set({ status, moderatedAt: new Date() }).where(eq(schema.reviews.id, id)).returning();
  if (!r) return { ok: false, message: "Sharh topilmadi" };
  await audit(actor, `review.${status}`, "florist", r.floristId, { reviewId: id, rating: r.rating });
  return { ok: true };
}

/** The shop's public answer to a review about its own order. */
export async function replyToReview(floristId: number, id: number, reply: string): Promise<Result> {
  const db = await getDb();
  const text = reply.trim().slice(0, 1000);
  const updated = await db
    .update(schema.reviews)
    .set({ floristReply: text || null })
    .where(and(eq(schema.reviews.id, id), eq(schema.reviews.floristId, floristId)))
    .returning({ id: schema.reviews.id });
  return updated.length ? { ok: true } : { ok: false, message: "Sharh topilmadi" };
}

export async function listReviews(opts: { status?: ReviewStatus; floristId?: number; limit?: number } = {}) {
  const db = await getDb();
  const where: SQL[] = [];
  if (opts.status) where.push(eq(schema.reviews.status, opts.status));
  if (opts.floristId) where.push(eq(schema.reviews.floristId, opts.floristId));
  return db
    .select({ r: schema.reviews, florist: schema.florists.name, number: schema.orders.number })
    .from(schema.reviews)
    .innerJoin(schema.florists, eq(schema.florists.id, schema.reviews.floristId))
    .innerJoin(schema.orders, eq(schema.orders.id, schema.reviews.orderId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.reviews.createdAt))
    .limit(opts.limit ?? 100);
}

export type PublicReview = { id: number; rating: number; text: string; authorName: string; reply: string | null; createdAt: Date };

/** Approved reviews for a shop, or for the orders that contained a product. */
export async function publicReviews(by: { floristId: number } | { productId: number }, limit = 6) {
  const db = await getDb();
  const cond =
    "floristId" in by
      ? eq(schema.reviews.floristId, by.floristId)
      : inArray(
          schema.reviews.orderId,
          db.select({ id: schema.orderItems.orderId }).from(schema.orderItems).where(eq(schema.orderItems.productId, by.productId)),
        );
  const where = and(eq(schema.reviews.status, "approved"), cond);
  const [rows, [summary]] = await Promise.all([
    db
      .select({
        id: schema.reviews.id,
        rating: schema.reviews.rating,
        text: schema.reviews.text,
        authorName: schema.reviews.authorName,
        reply: schema.reviews.floristReply,
        createdAt: schema.reviews.createdAt,
      })
      .from(schema.reviews)
      .where(where)
      .orderBy(desc(schema.reviews.createdAt))
      .limit(limit),
    db.select({ n: count(), avg: avg(schema.reviews.rating) }).from(schema.reviews).where(where),
  ]);
  return { reviews: rows as PublicReview[], count: summary.n, average: summary.n ? Math.round(Number(summary.avg) * 10) / 10 : null };
}

/* ------------------------------------------------------------------ */
/* Disputes                                                            */
/* ------------------------------------------------------------------ */

export const DISPUTE_REASONS = ["late", "quality", "wrong_item", "not_delivered", "other"] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];
export const DISPUTE_REASON_LABEL: Record<DisputeReason, string> = {
  late: "Kechikdi",
  quality: "Sifat / ko‘rinish",
  wrong_item: "Boshqa mahsulot keldi",
  not_delivered: "Yetkazilmadi",
  other: "Boshqa",
};
export const DISPUTE_STATUS_LABEL = { open: "Ochiq", resolved: "Hal qilindi", rejected: "Asossiz deb topildi" } as const;

/** Days after the delivery date during which a complaint can still be opened. */
export const DISPUTE_WINDOW_DAYS = 7;
const DISPUTE_STATUSES: Order["status"][] = ["confirmed", "preparing", "ready", "dispatched", "delivered"];

export function canOpenDispute(o: { status: Order["status"]; deliveryDate: string }, today = tashkentNow().date) {
  return DISPUTE_STATUSES.includes(o.status) && today <= addDaysISO(o.deliveryDate, DISPUTE_WINDOW_DAYS);
}

export async function orderDisputes(orderId: string) {
  const db = await getDb();
  return db.select().from(schema.disputes).where(eq(schema.disputes.orderId, orderId)).orderBy(desc(schema.disputes.createdAt));
}

/** One open complaint per order at a time. */
export async function openDispute(
  o: { id: string; status: Order["status"]; deliveryDate: string; floristId: number },
  input: { reason: string; message: string },
): Promise<Result & { disputeId?: number }> {
  if (!canOpenDispute(o)) return { ok: false, message: "closed" };
  if (!(DISPUTE_REASONS as readonly string[]).includes(input.reason)) return { ok: false, message: "reason" };
  const message = input.message.trim().slice(0, 2000);
  if (message.length < 10) return { ok: false, message: "message" };
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Lock the order row so two quick submits cannot both pass the "no open complaint" check.
    await tx.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.id, o.id)).for("update");
    const [open] = await tx
      .select({ id: schema.disputes.id })
      .from(schema.disputes)
      .where(and(eq(schema.disputes.orderId, o.id), eq(schema.disputes.status, "open")));
    if (open) return { ok: false as const, message: "exists" };
    const [d] = await tx
      .insert(schema.disputes)
      .values({ orderId: o.id, floristId: o.floristId, reason: input.reason as DisputeReason, message })
      .returning({ id: schema.disputes.id });
    return { ok: true as const, disputeId: d.id };
  });
}

/** The shop's explanation on a complaint about its own order (only while it is open). */
export async function floristDisputeNote(floristId: number, id: number, note: string): Promise<Result> {
  const text = note.trim().slice(0, 2000);
  if (text.length < 3) return { ok: false, message: "Izoh yozing" };
  const db = await getDb();
  const updated = await db
    .update(schema.disputes)
    .set({ floristNote: text })
    .where(and(eq(schema.disputes.id, id), eq(schema.disputes.floristId, floristId), eq(schema.disputes.status, "open")))
    .returning({ id: schema.disputes.id });
  return updated.length ? { ok: true } : { ok: false, message: "Murojaat topilmadi yoki yopilgan" };
}

export async function resolveDispute(actor: AuditActor, id: number, status: "resolved" | "rejected", resolution: string): Promise<Result> {
  const text = resolution.trim().slice(0, 2000);
  if (text.length < 3) return { ok: false, message: "Qaroringizni yozing — mijoz uni buyurtma sahifasida ko‘radi" };
  const db = await getDb();
  const [d] = await db
    .update(schema.disputes)
    .set({ status, resolution: text, resolvedBy: actor.email, resolvedAt: new Date() })
    .where(and(eq(schema.disputes.id, id), eq(schema.disputes.status, "open")))
    .returning();
  if (!d) return { ok: false, message: "Murojaat topilmadi yoki allaqachon yopilgan" };
  await audit(actor, `dispute.${status}`, "order", d.orderId, { disputeId: id, reason: d.reason });
  return { ok: true };
}

export async function listDisputes(opts: { status?: "open" | "resolved" | "rejected"; floristId?: number } = {}) {
  const db = await getDb();
  const where: SQL[] = [];
  if (opts.status) where.push(eq(schema.disputes.status, opts.status));
  if (opts.floristId) where.push(eq(schema.disputes.floristId, opts.floristId));
  return db
    .select({ d: schema.disputes, florist: schema.florists.name, number: schema.orders.number, orderId: schema.orders.id })
    .from(schema.disputes)
    .innerJoin(schema.florists, eq(schema.florists.id, schema.disputes.floristId))
    .innerJoin(schema.orders, eq(schema.orders.id, schema.disputes.orderId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.disputes.createdAt))
    .limit(200);
}

/* ------------------------------------------------------------------ */
/* Operational analytics                                               */
/* ------------------------------------------------------------------ */

export type ShopMetrics = {
  floristId: number;
  name: string;
  isPlatform: boolean;
  orders: number;
  delivered: number;
  rejected: number;
  cancelled: number;
  goods: number;
  commission: number;
  /** Median minutes from order to the shop's confirmation (null without data). */
  medianConfirmMinutes: number | null;
  disputes: number;
  rating: number | null;
  reviews: number;
};

/** Per-shop numbers for orders placed in the last `days` days. */
export async function shopMetrics(days: number): Promise<ShopMetrics[]> {
  const db = await getDb();
  const since = new Date(Date.now() - days * 86_400_000);
  const inPeriod = gte(schema.orders.createdAt, since);
  const [orders, confirm, disputes, ratings] = await Promise.all([
    db
      .select({
        floristId: schema.florists.id,
        name: schema.florists.name,
        isPlatform: schema.florists.isPlatform,
        orders: sql<number>`count(${schema.orders.id})::int`,
        delivered: sql<number>`count(*) filter (where ${schema.orders.status} = 'delivered')::int`,
        rejected: sql<number>`count(*) filter (where ${schema.orders.status} = 'rejected')::int`,
        cancelled: sql<number>`count(*) filter (where ${schema.orders.status} = 'cancelled')::int`,
        goods: sql<number>`coalesce(sum(${schema.orders.subtotal} - ${schema.orders.discount}) filter (where ${schema.orders.status} = 'delivered'), 0)::bigint`,
        commission: sql<number>`coalesce(sum(${schema.orders.commissionAmount}) filter (where ${schema.orders.status} = 'delivered'), 0)::bigint`,
      })
      .from(schema.florists)
      .leftJoin(schema.orders, and(eq(schema.orders.floristId, schema.florists.id), inPeriod))
      .where(inArray(schema.florists.status, ["approved", "suspended"]))
      .groupBy(schema.florists.id, schema.florists.name, schema.florists.isPlatform)
      .orderBy(desc(schema.florists.isPlatform), asc(schema.florists.name)),
    // First confirmation of each order, measured from the order time.
    db
      .select({
        floristId: schema.orders.floristId,
        minutes: sql<number>`percentile_cont(0.5) within group (order by extract(epoch from (${schema.orderEvents.createdAt} - ${schema.orders.createdAt})) / 60)`,
      })
      .from(schema.orderEvents)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderEvents.orderId))
      .where(and(eq(schema.orderEvents.toStatus, "confirmed"), inPeriod))
      .groupBy(schema.orders.floristId),
    db
      .select({ floristId: schema.disputes.floristId, n: count() })
      .from(schema.disputes)
      .where(gte(schema.disputes.createdAt, since))
      .groupBy(schema.disputes.floristId),
    db
      .select({ floristId: schema.reviews.floristId, n: count(), avg: avg(schema.reviews.rating) })
      .from(schema.reviews)
      .where(eq(schema.reviews.status, "approved"))
      .groupBy(schema.reviews.floristId),
  ]);
  const c = new Map(confirm.map((r) => [r.floristId, r.minutes == null ? null : Math.round(Number(r.minutes))]));
  const d = new Map(disputes.map((r) => [r.floristId, r.n]));
  const r = new Map(ratings.map((x) => [x.floristId, x]));
  return orders.map((o) => ({
    ...o,
    goods: Number(o.goods),
    commission: Number(o.commission),
    medianConfirmMinutes: c.get(o.floristId) ?? null,
    disputes: d.get(o.floristId) ?? 0,
    rating: r.get(o.floristId)?.avg != null ? Math.round(Number(r.get(o.floristId)!.avg) * 10) / 10 : null,
    reviews: r.get(o.floristId)?.n ?? 0,
  }));
}
