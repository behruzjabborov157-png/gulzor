import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hashPassword } from "@/lib/auth";
import { isPlainEmail } from "@/lib/email";
import { normalizePhone, slugify } from "@/lib/format";
import { changeOrderStatus, ORDER_TRANSITIONS, type Order } from "@/lib/orders";

/*
 * Everything a florist may do, always scoped to its own shop. Pages and server actions in /florist only call
 * these functions with the florist id taken from the signed-in session (requireFlorist), never from the request.
 */

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

export type FloristApplication = {
  shopName: string;
  contactName: string;
  email: string;
  password: string;
  phone: string;
  telegramUsername: string;
  regionId: number | null;
  address: string;
  legalName: string;
  taxId: string;
  description: string;
  acceptTerms: boolean;
};

export type RegisterResult = { ok: true; userId: string; floristId: number } | { ok: false; errors: Record<string, string> };

/** Uzbek taxpayer number (STIR / INN): 9 digits. */
export const isTaxId = (v: string) => /^\d{9}$/.test(v);
/** Empty, or a valid Telegram username (with or without @). */
export const isTelegramUsername = (v: string) => {
  const u = v.trim().replace(/^@/, "");
  return u === "" || /^[A-Za-z0-9_]{4,32}$/.test(u);
};
const TG_ERROR = "Telegram username noto‘g‘ri (lotin harflari, raqam va _, 4–32 belgi)";

export async function registerFlorist(a: FloristApplication): Promise<RegisterResult> {
  const errors: Record<string, string> = {};
  const email = a.email.trim().toLowerCase();
  const phone = normalizePhone(a.phone);
  if (a.shopName.trim().length < 2) errors.shopName = "Do‘kon nomini kiriting";
  if (a.contactName.trim().length < 2) errors.contactName = "Ismingizni kiriting";
  if (!isPlainEmail(email)) errors.email = "Email noto‘g‘ri";
  if (a.password.length < 12) errors.password = "Parol kamida 12 belgidan iborat bo‘lsin";
  if (!phone) errors.phone = "Telefon raqami noto‘g‘ri";
  if (!isTelegramUsername(a.telegramUsername)) errors.telegramUsername = TG_ERROR;
  if (!a.regionId) errors.regionId = "Shaharni tanlang";
  if (a.address.trim().length < 5) errors.address = "Do‘kon manzilini kiriting";
  if (a.legalName.trim().length < 2) errors.legalName = "Yuridik nomni kiriting (YaTT yoki MChJ)";
  if (!isTaxId(a.taxId.trim())) errors.taxId = "STIR 9 ta raqamdan iborat";
  if (!a.acceptTerms) errors.acceptTerms = "Shartlarga rozilik kerak";
  if (Object.keys(errors).length) return { ok: false, errors };

  const db = await getDb();
  const [taken] = await db.select({ id: schema.adminUsers.id }).from(schema.adminUsers).where(eq(schema.adminUsers.email, email));
  if (taken) return { ok: false, errors: { email: "Bu email bilan hisob mavjud — kirish sahifasidan foydalaning" } };
  const [region] = await db.select({ id: schema.deliveryRegions.id }).from(schema.deliveryRegions).where(eq(schema.deliveryRegions.id, a.regionId!));
  if (!region) return { ok: false, errors: { regionId: "Shaharni tanlang" } };

  // A readable, unique public address for the shop page (/dokon/<slug>).
  const base = slugify(a.shopName) || "dokon";
  let slug = base;
  for (let i = 2; ; i++) {
    const [exists] = await db.select({ id: schema.florists.id }).from(schema.florists).where(eq(schema.florists.slug, slug));
    if (!exists) break;
    slug = `${base}-${i}`;
  }
  const passwordHash = await hashPassword(a.password); // before the transaction (slow, and keeps the transaction short)

  return db.transaction(async (tx) => {
    const [florist] = await tx
      .insert(schema.florists)
      .values({
        slug,
        name: a.shopName.trim().slice(0, 80),
        description: a.description.trim().slice(0, 1000),
        status: "pending",
        phone: phone!,
        telegramUsername: a.telegramUsername.trim().replace(/^@/, "").slice(0, 64),
        address: a.address.trim().slice(0, 200),
        regionId: region.id,
        legalName: a.legalName.trim().slice(0, 120),
        taxId: a.taxId.trim(),
      })
      .returning();
    const [user] = await tx
      .insert(schema.adminUsers)
      .values({ email, name: a.contactName.trim().slice(0, 80), passwordHash, role: "florist", floristId: florist.id })
      .returning({ id: schema.adminUsers.id });
    return { ok: true as const, userId: user.id, floristId: florist.id };
  });
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

/**
 * What a florist may do with its orders: accept or reject new ones and move them along.
 * Cancelling an accepted order is a platform decision (admin), so it is not offered here.
 */
export const FLORIST_TRANSITIONS: Record<Order["status"], Order["status"][]> = Object.fromEntries(
  Object.entries(ORDER_TRANSITIONS).map(([from, to]) => [from, to.filter((s) => s !== "cancelled")]),
) as Record<Order["status"], Order["status"][]>;

export async function floristOrders(floristId: number, opts: { status?: Order["status"]; limit?: number } = {}) {
  const db = await getDb();
  return db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.floristId, floristId), opts.status ? eq(schema.orders.status, opts.status) : undefined))
    .orderBy(desc(schema.orders.createdAt))
    .limit(opts.limit ?? 100);
}

/** One of the florist's own orders with items and public history, or null (another shop's order looks like a missing one). */
export async function floristOrder(floristId: number, orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const db = await getDb();
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.floristId, floristId)));
  if (!order) return null;
  const [items, events] = await Promise.all([
    db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId)),
    db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, orderId)).orderBy(desc(schema.orderEvents.createdAt)),
  ]);
  return { order, items, events };
}

export type ChangeResult = { ok: true } | { ok: false; message: string };

export async function floristChangeStatus(floristId: number, actorEmail: string, orderId: string, to: Order["status"], reason = ""): Promise<ChangeResult> {
  const found = await floristOrder(floristId, orderId);
  if (!found) return { ok: false, message: "Buyurtma topilmadi" };
  if (!FLORIST_TRANSITIONS[found.order.status].includes(to)) return { ok: false, message: "Bu holatga o‘tkazib bo‘lmaydi" };
  if (to === "rejected" && reason.trim().length < 3) return { ok: false, message: "Rad etish sababini yozing" };
  const changed = await changeOrderStatus(orderId, to, `florist:${actorEmail}`, reason.trim().slice(0, 300));
  return changed ? { ok: true } : { ok: false, message: "Holat allaqachon o‘zgargan — sahifani yangilang" };
}

/** Cash is collected by the florist itself, so the florist confirms it was paid (online payments are confirmed by the provider). */
export async function floristMarkCashPaid(floristId: number, actorEmail: string, orderId: string): Promise<ChangeResult> {
  const found = await floristOrder(floristId, orderId);
  if (!found) return { ok: false, message: "Buyurtma topilmadi" };
  const o = found.order;
  if (o.paymentMethod !== "cash") return { ok: false, message: "Onlayn to‘lovni to‘lov tizimi tasdiqlaydi" };
  if (o.paymentStatus === "paid") return { ok: true };
  if (!["ready", "dispatched", "delivered"].includes(o.status)) return { ok: false, message: "Avval buyurtmani tayyorlang" };
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.update(schema.orders).set({ paymentStatus: "paid", updatedAt: new Date() }).where(eq(schema.orders.id, o.id));
    await tx.insert(schema.orderEvents).values({
      orderId: o.id,
      type: "payment",
      message: "Naqd to‘lov qabul qilindi",
      code: "payment_paid",
      params: { provider: "cash", amount: o.total },
      actor: `florist:${actorEmail}`,
      isPublic: true,
    });
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Delivery zones                                                      */
/* ------------------------------------------------------------------ */

export type ZoneInput = {
  regionId: number;
  name: string;
  nameRu: string | null;
  description: string;
  fee: number;
  freeFrom: number | null;
  minOrder: number | null;
  sameDayEnabled: boolean;
  sameDayCutoff: string;
  minLeadMinutes: number;
  isActive: boolean;
};

export function floristZones(floristId: number) {
  return getDb().then((db) => db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.floristId, floristId)).orderBy(schema.deliveryZones.sortOrder, schema.deliveryZones.id));
}

/** Creates or updates one of the florist's zones. Another shop's zone id is treated as not found. */
export async function saveFloristZone(floristId: number, zoneId: number | null, z: ZoneInput): Promise<ChangeResult> {
  if (z.name.trim().length < 2) return { ok: false, message: "Hudud nomini kiriting" };
  if (!Number.isInteger(z.fee) || z.fee < 0) return { ok: false, message: "Yetkazish narxi noto‘g‘ri" };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(z.sameDayCutoff)) return { ok: false, message: "Vaqt HH:MM ko‘rinishida bo‘lsin" };
  const db = await getDb();
  const [region] = await db.select({ id: schema.deliveryRegions.id }).from(schema.deliveryRegions).where(eq(schema.deliveryRegions.id, z.regionId));
  if (!region) return { ok: false, message: "Shaharni tanlang" };
  const values = { ...z, name: z.name.trim().slice(0, 80), description: z.description.trim().slice(0, 300) };
  if (zoneId) {
    const res = await db
      .update(schema.deliveryZones)
      .set(values)
      .where(and(eq(schema.deliveryZones.id, zoneId), eq(schema.deliveryZones.floristId, floristId)))
      .returning({ id: schema.deliveryZones.id });
    if (!res.length) return { ok: false, message: "Hudud topilmadi" };
  } else {
    await db.insert(schema.deliveryZones).values({ ...values, floristId });
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Profile and reports                                                 */
/* ------------------------------------------------------------------ */

export type ProfileInput = {
  name: string;
  nameRu: string | null;
  description: string;
  descriptionRu: string | null;
  phone: string;
  telegramUsername: string;
  address: string;
  addressRu: string | null;
};

/** Reads the ProfileFields form (components/florist/profile-fields.tsx). */
export function profileFromForm(form: FormData): ProfileInput {
  const text = (key: string) => String(form.get(key) ?? "");
  return {
    name: text("name"),
    nameRu: text("nameRu") || null,
    description: text("description"),
    descriptionRu: text("descriptionRu") || null,
    phone: text("phone"),
    telegramUsername: text("telegramUsername"),
    address: text("address"),
    addressRu: text("addressRu") || null,
  };
}

export async function updateFloristProfile(floristId: number, p: ProfileInput): Promise<ChangeResult> {
  const phone = normalizePhone(p.phone);
  if (p.name.trim().length < 2) return { ok: false, message: "Do‘kon nomini kiriting" };
  if (!phone) return { ok: false, message: "Telefon raqami noto‘g‘ri" };
  if (!isTelegramUsername(p.telegramUsername)) return { ok: false, message: TG_ERROR };
  const db = await getDb();
  await db
    .update(schema.florists)
    .set({
      name: p.name.trim().slice(0, 80),
      nameRu: p.nameRu?.trim() || null,
      description: p.description.trim().slice(0, 1000),
      descriptionRu: p.descriptionRu?.trim() || null,
      phone,
      telegramUsername: p.telegramUsername.trim().replace(/^@/, "").slice(0, 64),
      address: p.address.trim().slice(0, 200),
      addressRu: p.addressRu?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.florists.id, floristId));
  return { ok: true };
}

/** Delivered orders per month: count, goods value (after discount) and Gulzor's commission. */
export async function floristSalesReport(floristId: number) {
  const db = await getDb();
  const month = sql<string>`to_char((${schema.orders.createdAt} AT TIME ZONE 'UTC') + interval '5 hours', 'YYYY-MM')`;
  return db
    .select({
      month,
      orders: sql<number>`count(*)::int`,
      goods: sql<number>`coalesce(sum(${schema.orders.subtotal} - ${schema.orders.discount}), 0)::bigint`,
      commission: sql<number>`coalesce(sum(${schema.orders.commissionAmount}), 0)::bigint`,
    })
    .from(schema.orders)
    .where(and(eq(schema.orders.floristId, floristId), eq(schema.orders.status, "delivered")))
    .groupBy(month)
    .orderBy(desc(month))
    .limit(24);
}

/** Small numbers for the dashboard. */
export async function floristOverview(floristId: number) {
  const db = await getDb();
  const [o] = await db
    .select({
      fresh: sql<number>`count(*) FILTER (WHERE ${schema.orders.status} = 'new')::int`,
      active: sql<number>`count(*) FILTER (WHERE ${schema.orders.status} IN ('confirmed','preparing','ready','dispatched'))::int`,
      delivered: sql<number>`count(*) FILTER (WHERE ${schema.orders.status} = 'delivered')::int`,
    })
    .from(schema.orders)
    .where(eq(schema.orders.floristId, floristId));
  const [p] = await db
    .select({ n: sql<number>`count(*)::int`, active: sql<number>`count(*) FILTER (WHERE ${schema.products.status} = 'active')::int` })
    .from(schema.products)
    .where(eq(schema.products.floristId, floristId));
  const [z] = await db
    .select({ n: sql<number>`count(*) FILTER (WHERE ${schema.deliveryZones.isActive})::int` })
    .from(schema.deliveryZones)
    .where(eq(schema.deliveryZones.floristId, floristId));
  return { orders: o, products: p, activeZones: z.n };
}

/** The florist's own products for the panel list. */
export async function floristProducts(floristId: number) {
  const db = await getDb();
  return db.select().from(schema.products).where(eq(schema.products.floristId, floristId)).orderBy(desc(schema.products.updatedAt)).limit(500);
}

/** Order ids that belong to the florist (used to scope bulk reads). */
export async function ownsOrders(floristId: number, ids: string[]) {
  if (!ids.length) return [];
  const db = await getDb();
  const rows = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(and(inArray(schema.orders.id, ids), eq(schema.orders.floristId, floristId)));
  return rows.map((r) => r.id);
}
