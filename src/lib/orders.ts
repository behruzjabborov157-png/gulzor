import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { DEFAULT_LOCALE, fmt, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { normalizePhone } from "@/lib/format";
import { availablePaymentMethods } from "@/lib/payments/config";
import { adjustStock, cartLineSchema, quoteCart, StockError, type Quote } from "@/lib/quote";
import { getSettings } from "@/lib/settings";
import { notifyOrderEmail } from "@/lib/email";
import { notifyOrder } from "@/lib/telegram";
import { telegramUserFromInitData } from "@/lib/telegram-miniapp";
import { commissionFor } from "@/lib/florists";
import { tashkentNow } from "@/lib/time";

export type Order = typeof schema.orders.$inferSelect;
export type OrderItem = typeof schema.orderItems.$inferSelect;

export const ORDER_STATUS_LABEL: Record<Order["status"], string> = {
  new: "Yangi",
  confirmed: "Tasdiqlandi",
  preparing: "Tayyorlanmoqda",
  ready: "Tayyor",
  dispatched: "Yo‘lda",
  delivered: "Yetkazildi",
  cancelled: "Bekor qilindi",
  rejected: "Rad etildi",
};

export const PAYMENT_STATUS_LABEL: Record<Order["paymentStatus"], string> = {
  pending: "To‘lov kutilmoqda",
  paid: "To‘langan",
  failed: "To‘lov amalga oshmadi",
  cancelled: "To‘lov bekor qilindi",
  refunded: "Pul qaytarildi",
};

export const PAYMENT_METHOD_LABEL: Record<Order["paymentMethod"], string> = {
  cash: "Naqd pul",
  payme: "Payme",
  click: "Click",
};

/** Checkout validation with messages in the customer's language. */
export function makeCheckoutSchema(locale: Locale = DEFAULT_LOCALE) {
  const e = getDict(locale).errors;
  const phone = z
    .string()
    .trim()
    .transform((v, ctx) => {
      const p = normalizePhone(v);
      if (!p) {
        ctx.addIssue({ code: "custom", message: e.checkout.phone });
        return z.NEVER;
      }
      return p;
    });
  const text = (max: number) => z.string().trim().max(max, fmt(e.checkout.tooLong, { max })).default("");

  return z
  .object({
    lines: z.array(cartLineSchema).min(1, e.quote.emptyCart).max(30),
    couponCode: z.string().trim().max(40).optional().nullable(),
    fulfillment: z.enum(["delivery", "pickup"]),
    customerName: z.string().trim().min(2, e.checkout.name).max(80),
    customerPhone: phone,
    recipientIsCustomer: z.boolean(),
    recipientName: text(80),
    recipientPhone: z.string().trim().max(30).default(""),
    anonymous: z.boolean().default(false),
    zoneId: z.number().int().positive().nullable().optional(),
    district: text(80),
    neighborhood: text(80),
    address: text(200),
    apartment: text(40),
    landmark: text(160),
    date: z.string(),
    slotId: z.number().int().positive({ message: e.checkout.slot }),
    courierNote: text(500),
    cardMessage: text(300),
    paymentMethod: z.enum(["cash", "payme", "click"]),
    saveAddress: z.boolean().default(false),
    submissionId: z.string().uuid().optional(),
    /** Raw Telegram Mini App initData; only used after its signature is verified. */
    telegramInitData: z.string().max(8192).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.recipientIsCustomer) {
      if (v.recipientName.length < 2) ctx.addIssue({ code: "custom", path: ["recipientName"], message: e.checkout.recipientName });
      if (!normalizePhone(v.recipientPhone)) ctx.addIssue({ code: "custom", path: ["recipientPhone"], message: e.checkout.recipientPhone });
    }
    if (v.fulfillment === "delivery") {
      if (!v.zoneId) ctx.addIssue({ code: "custom", path: ["zoneId"], message: e.checkout.zone });
      if (v.address.length < 5) ctx.addIssue({ code: "custom", path: ["address"], message: e.checkout.address });
    }
  });
}

export const checkoutSchema = makeCheckoutSchema();
export type CheckoutInput = z.input<typeof checkoutSchema>;

export type CreateOrderResult =
  | { ok: true; orderId: string; number: string; accessToken: string; paymentMethod: Order["paymentMethod"]; duplicate?: boolean }
  | { ok: false; errors: string[]; fieldErrors?: Record<string, string>; quote?: Quote };

function orderNumber() {
  const { date } = tashkentNow();
  return `GZ-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}-${randomInt(1000, 10000)}`;
}

/**
 * Server-only extras that never come from the request body: the ordering bot passes the Telegram user
 * (its webhook is authenticated by Telegram's secret header) and a shared map location.
 */
export type CreateOrderOptions = {
  telegram?: { id: number; username?: string };
  location?: { latitude: number; longitude: number };
};

export async function createOrder(
  raw: unknown,
  customerId: string | null,
  locale: Locale = DEFAULT_LOCALE,
  opts: CreateOrderOptions = {},
): Promise<CreateOrderResult> {
  const e = getDict(locale).errors.checkout;
  const parsed = makeCheckoutSchema(locale).safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".") || "_"] ??= i.message;
    return { ok: false, errors: [e.fixFields], fieldErrors };
  }
  const v = parsed.data;
  // Double-click, retry after a dropped connection or a resubmitted form: same submission id → same order.
  const previous = v.submissionId ? await orderBySubmission(v.submissionId) : null;
  if (previous) return previous;
  const { checkout } = await getSettings();

  if (!availablePaymentMethods(checkout).some((m) => m.id === v.paymentMethod)) {
    return { ok: false, errors: [e.paymentUnavailable], fieldErrors: { paymentMethod: e.paymentRequired } };
  }

  // Authoritative server-side recalculation of every price, fee and availability.
  const quote = await quoteCart(
    { lines: v.lines, couponCode: v.couponCode, fulfillment: v.fulfillment, zoneId: v.zoneId, date: v.date, slotId: v.slotId },
    { forCheckout: true, locale },
  );
  if (quote.errors.length) return { ok: false, errors: quote.errors, quote };
  // quoteCart guarantees exactly one approved florist when there are no errors.
  const floristId = quote.florist!.id;
  const db0 = await getDb();
  const [floristRow] = await db0.select({ rate: schema.florists.commissionRate }).from(schema.florists).where(eq(schema.florists.id, floristId));
  const commissionRate = floristRow?.rate ?? 0;
  const commissionAmount = commissionFor(commissionRate, quote.subtotal - quote.discount);

  const slot = quote.slots.find((s) => s.id === v.slotId)!;
  const recipientName = v.recipientIsCustomer ? v.customerName : v.recipientName;
  const recipientPhone = v.recipientIsCustomer ? v.customerPhone : normalizePhone(v.recipientPhone)!;
  const accessToken = randomBytes(18).toString("base64url");
  // Ordered inside the Telegram Mini App: link the Telegram account (signature-checked, never trusted blindly).
  const tgUser = opts.telegram ?? telegramUserFromInitData(v.telegramInitData);
  const db = await getDb();

  let created: Order | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    try {
      created = await db.transaction(async (tx) => {
        // Re-check slot capacity under a row lock so simultaneous orders cannot overbook a time window.
        const [slotRow] = await tx.select().from(schema.timeSlots).where(eq(schema.timeSlots.id, slot.id)).for("update");
        if (slotRow?.capacity != null) {
          const [{ n }] = await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(schema.orders)
            .where(
              and(
                eq(schema.orders.deliveryDate, v.date),
                eq(schema.orders.slotId, slot.id),
                eq(schema.orders.floristId, floristId),
                sql`${schema.orders.status} NOT IN ('cancelled', 'rejected')`,
              ),
            );
          if (n >= slotRow.capacity) throw new SlotFullError();
        }
        await adjustStock(
          tx,
          quote.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, addons: l.addons })),
        );
        if (quote.coupon?.applied) {
          const res = await tx
            .update(schema.coupons)
            .set({ usedCount: sql`${schema.coupons.usedCount} + 1` })
            .where(
              and(
                eq(schema.coupons.code, quote.coupon.code),
                sql`(${schema.coupons.usageLimit} IS NULL OR ${schema.coupons.usedCount} < ${schema.coupons.usageLimit})`,
              ),
            )
            .returning({ id: schema.coupons.id });
          if (!res.length) throw new Error("COUPON_EXHAUSTED");
        }
        const [order] = await tx
          .insert(schema.orders)
          .values({
            number: orderNumber(),
            accessToken,
            floristId,
            commissionRate,
            commissionAmount,
            idempotencyKey: v.submissionId ?? null,
            telegramUserId: tgUser ? String(tgUser.id) : null,
            telegramUsername: tgUser?.username ?? null,
            latitude: opts.location?.latitude ?? null,
            longitude: opts.location?.longitude ?? null,
            customerId,
            paymentMethod: v.paymentMethod,
            fulfillment: v.fulfillment,
            customerName: v.customerName,
            customerPhone: v.customerPhone,
            recipientName,
            recipientPhone,
            anonymous: v.anonymous,
            regionId: quote.zone?.regionId ?? null,
            zoneId: quote.zone?.id ?? null,
            regionName: quote.zone?.regionNameUz ?? null,
            zoneName: quote.zone?.nameUz ?? null,
            locale,
            district: v.fulfillment === "delivery" ? v.district : "",
            neighborhood: v.fulfillment === "delivery" ? v.neighborhood : "",
            address: v.fulfillment === "delivery" ? v.address : checkout.pickupAddress,
            apartment: v.fulfillment === "delivery" ? v.apartment : "",
            landmark: v.fulfillment === "delivery" ? v.landmark : "",
            deliveryDate: v.date,
            slotId: slot.id,
            slotLabel: slot.label,
            courierNote: v.courierNote,
            cardMessage: v.cardMessage,
            subtotal: quote.subtotal,
            discount: quote.discount,
            deliveryFee: quote.deliveryFee,
            serviceFee: quote.serviceFee,
            total: quote.total,
            couponCode: quote.coupon?.applied ? quote.coupon.code : null,
            containsDemo: quote.containsDemo,
          })
          .returning();
        await tx.insert(schema.orderItems).values(
          quote.lines.map((l) => ({
            orderId: order.id,
            productId: l.productId,
            variantId: l.variantId,
            productName: l.nameUz,
            variantName: l.variantNameUz,
            stems: l.stems,
            color: l.color,
            imageUrl: l.image,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            addons: l.addonsUz,
            lineTotal: l.lineTotal,
          })),
        );
        for (const l of quote.lines) {
          await tx
            .update(schema.products)
            .set({ salesCount: sql`${schema.products.salesCount} + ${l.quantity}` })
            .where(eq(schema.products.id, l.productId));
        }
        await tx.insert(schema.orderEvents).values({
          orderId: order.id,
          type: "status",
          toStatus: "new",
          code: "order_received",
          message: "Buyurtma qabul qilindi",
          actor: "customer",
          isPublic: true,
        });
        if (customerId && v.saveAddress && v.fulfillment === "delivery") {
          await tx.insert(schema.customerAddresses).values({
            customerId,
            label: v.address.slice(0, 40),
            recipientName,
            recipientPhone,
            regionId: quote.zone?.regionId ?? null,
            zoneId: quote.zone?.id ?? null,
            district: v.district,
            neighborhood: v.neighborhood,
            address: v.address,
            apartment: v.apartment,
            landmark: v.landmark,
          });
        }
        return order;
      });
    } catch (err) {
      if (err instanceof StockError) return { ok: false, errors: [e.stockGone] };
      if (err instanceof SlotFullError) return { ok: false, errors: [e.slotFull], fieldErrors: { slotId: e.slotFull } };
      if ((err as Error).message === "COUPON_EXHAUSTED") return { ok: false, errors: [getDict(locale).errors.quote.couponExhausted] };
      if (isUniqueViolation(err, "orders_number_idx")) continue; // order number collision — retry
      if (v.submissionId && isUniqueViolation(err, "orders_idempotency_idx")) {
        // A parallel request with the same submission id won the race (its transaction kept the stock).
        const winner = await orderBySubmission(v.submissionId);
        if (winner) return winner;
      }
      throw err;
    }
  }
  if (!created) return { ok: false, errors: [e.numberFailed] };

  return { ok: true, orderId: created.id, number: created.number, accessToken, paymentMethod: created.paymentMethod };
}

async function orderBySubmission(key: string): Promise<CreateOrderResult | null> {
  const db = await getDb();
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.idempotencyKey, key));
  return o ? { ok: true, orderId: o.id, number: o.number, accessToken: o.accessToken, paymentMethod: o.paymentMethod, duplicate: true } : null;
}

class SlotFullError extends Error {
  constructor() {
    super("Tanlangan vaqt oralig‘i band bo‘lib qoldi. Boshqa vaqtni tanlang.");
  }
}

/** True when the error (or its driver-level cause) is a unique violation of the given constraint. */
function isUniqueViolation(e: unknown, constraint: string): boolean {
  for (let cur = e as Record<string, unknown> | undefined, i = 0; cur && i < 4; cur = cur.cause as Record<string, unknown> | undefined, i++) {
    if (cur.code === "23505" && (cur.constraint === constraint || cur.constraint_name === constraint)) return true;
  }
  return false;
}

/**
 * Sends the owner notification for a newly stored order. Called after the response
 * (see checkoutAction) so a slow Telegram API never delays checkout. Never throws.
 */
export async function notifyNewOrder(orderId: string) {
  try {
    const db = await getDb();
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    if (!order) return;
    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    // Both channels run independently; each logs its own outcome on the order.
    const results = await Promise.allSettled([notifyOrder({ ...order, items }), notifyOrderEmail({ ...order, items })]);
    for (const r of results) if (r.status === "rejected") console.error("Order notification failed", r.reason);
  } catch (e) {
    console.error("Order notification failed", e);
  }
}

/**
 * Admin status change. Cancelling/rejecting returns reserved stock, the coupon use and
 * the sales counters, all in one transaction. Returns false if the transition is not allowed.
 */
export async function changeOrderStatus(orderId: string, to: Order["status"], actor: string, reason = ""): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for("update");
    if (!o || !ORDER_TRANSITIONS[o.status].includes(to)) return false;
    const closing = to === "cancelled" || to === "rejected";
    await tx
      .update(schema.orders)
      .set({ status: to, updatedAt: new Date(), cancelReason: closing ? reason || null : o.cancelReason })
      .where(eq(schema.orders.id, orderId));
    if (closing) {
      const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
      await adjustStock(tx, items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, addons: i.addons })), -1);
      for (const i of items) {
        if (!i.productId) continue;
        await tx
          .update(schema.products)
          .set({ salesCount: sql`GREATEST(${schema.products.salesCount} - ${i.quantity}, 0)` })
          .where(eq(schema.products.id, i.productId));
      }
      if (o.couponCode) {
        await tx
          .update(schema.coupons)
          .set({ usedCount: sql`GREATEST(${schema.coupons.usedCount} - 1, 0)` })
          .where(eq(schema.coupons.code, o.couponCode));
      }
    }
    await tx.insert(schema.orderEvents).values({
      orderId,
      type: "status",
      toStatus: to,
      message: `Holat: ${ORDER_STATUS_LABEL[to]}${reason ? ` — ${reason}` : ""}`,
      code: "status",
      params: reason ? { reason } : null,
      actor,
      isPublic: true,
    });
    return true;
  });
}

export async function getOrderWithItems(where: { id?: string; number?: string }) {
  const db = await getDb();
  const cond = where.id ? eq(schema.orders.id, where.id) : eq(schema.orders.number, where.number ?? "");
  const [order] = await db.select().from(schema.orders).where(cond);
  if (!order) return null;
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id)).orderBy(asc(schema.orderItems.id));
  const events = await db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, order.id)).orderBy(asc(schema.orderEvents.createdAt), asc(schema.orderEvents.id));
  return { order, items, events };
}

export async function customerOrders(customerId: string) {
  const db = await getDb();
  return db.select().from(schema.orders).where(eq(schema.orders.customerId, customerId)).orderBy(desc(schema.orders.createdAt)).limit(50);
}

/** Customer-facing status steps for the tracking timeline. */
export const TRACK_STEPS: { status: Order["status"]; label: string }[] = [
  { status: "new", label: "Qabul qilindi" },
  { status: "confirmed", label: "Tasdiqlandi" },
  { status: "preparing", label: "Tayyorlanmoqda" },
  { status: "dispatched", label: "Yo‘lda" },
  { status: "delivered", label: "Yetkazildi" },
];

/** Allowed admin status changes. Cancelling/rejecting returns reserved stock. */
export const ORDER_TRANSITIONS: Record<Order["status"], Order["status"][]> = {
  new: ["confirmed", "rejected", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["dispatched", "delivered", "cancelled"],
  dispatched: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  rejected: [],
};
