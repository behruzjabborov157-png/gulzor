import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { normalizePhone } from "@/lib/format";
import { availablePaymentMethods } from "@/lib/payments/config";
import { adjustStock, cartLineSchema, quoteCart, StockError, type Quote } from "@/lib/quote";
import { getSettings } from "@/lib/settings";
import { notifyOrder } from "@/lib/telegram";
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

const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Telefon raqami noto‘g‘ri (+998 XX XXX XX XX)" });
      return z.NEVER;
    }
    return p;
  });

const text = (max: number) => z.string().trim().max(max, `Ko‘pi bilan ${max} belgi`).default("");

export const checkoutSchema = z
  .object({
    lines: z.array(cartLineSchema).min(1, "Savat bo‘sh").max(30),
    couponCode: z.string().trim().max(40).optional().nullable(),
    fulfillment: z.enum(["delivery", "pickup"]),
    customerName: z.string().trim().min(2, "Ismingizni kiriting").max(80),
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
    slotId: z.number().int().positive({ message: "Vaqtni tanlang" }),
    courierNote: text(500),
    cardMessage: text(300),
    paymentMethod: z.enum(["cash", "payme", "click"]),
    saveAddress: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (!v.recipientIsCustomer) {
      if (v.recipientName.length < 2) ctx.addIssue({ code: "custom", path: ["recipientName"], message: "Qabul qiluvchi ismini kiriting" });
      if (!normalizePhone(v.recipientPhone)) ctx.addIssue({ code: "custom", path: ["recipientPhone"], message: "Qabul qiluvchi telefoni noto‘g‘ri" });
    }
    if (v.fulfillment === "delivery") {
      if (!v.zoneId) ctx.addIssue({ code: "custom", path: ["zoneId"], message: "Hududni tanlang" });
      if (v.address.length < 5) ctx.addIssue({ code: "custom", path: ["address"], message: "Ko‘cha va uy raqamini kiriting" });
    }
  });

export type CheckoutInput = z.input<typeof checkoutSchema>;

export type CreateOrderResult =
  | { ok: true; orderId: string; number: string; accessToken: string; paymentMethod: Order["paymentMethod"] }
  | { ok: false; errors: string[]; fieldErrors?: Record<string, string>; quote?: Quote };

function orderNumber() {
  const { date } = tashkentNow();
  return `GZ-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}-${randomInt(1000, 10000)}`;
}

export async function createOrder(raw: unknown, customerId: string | null): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".") || "_"] ??= i.message;
    return { ok: false, errors: ["Iltimos, belgilangan maydonlarni to‘g‘rilang"], fieldErrors };
  }
  const v = parsed.data;
  const { checkout } = await getSettings();

  if (!availablePaymentMethods(checkout).some((m) => m.id === v.paymentMethod)) {
    return { ok: false, errors: ["Tanlangan to‘lov usuli hozir mavjud emas"], fieldErrors: { paymentMethod: "To‘lov usulini tanlang" } };
  }

  // Authoritative server-side recalculation of every price, fee and availability.
  const quote = await quoteCart(
    { lines: v.lines, couponCode: v.couponCode, fulfillment: v.fulfillment, zoneId: v.zoneId, date: v.date, slotId: v.slotId },
    { forCheckout: true },
  );
  if (quote.errors.length) return { ok: false, errors: quote.errors, quote };

  const slot = quote.slots.find((s) => s.id === v.slotId)!;
  const recipientName = v.recipientIsCustomer ? v.customerName : v.recipientName;
  const recipientPhone = v.recipientIsCustomer ? v.customerPhone : normalizePhone(v.recipientPhone)!;
  const accessToken = randomBytes(18).toString("base64url");
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
            regionName: quote.zone?.regionName ?? null,
            zoneName: quote.zone?.name ?? null,
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
            productName: l.name,
            variantName: l.variantName,
            stems: l.stems,
            color: l.color,
            imageUrl: l.image,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            addons: l.addons,
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
    } catch (e) {
      if (e instanceof StockError) return { ok: false, errors: [e.message + ". Savatni yangilang."] };
      if (e instanceof SlotFullError) return { ok: false, errors: [e.message], fieldErrors: { slotId: e.message } };
      if ((e as Error).message === "COUPON_EXHAUSTED") return { ok: false, errors: ["Promokoddan foydalanish limiti tugagan"] };
      if (isUniqueViolation(e, "orders_number_idx")) continue; // order number collision — retry
      throw e;
    }
  }
  if (!created) return { ok: false, errors: ["Buyurtma raqamini yaratib bo‘lmadi, qayta urinib ko‘ring"] };

  return { ok: true, orderId: created.id, number: created.number, accessToken, paymentMethod: created.paymentMethod };
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
    await notifyOrder({ ...order, items });
  } catch (e) {
    console.error("Telegram notify failed", e);
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
