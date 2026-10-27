"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import {
  clientIp,
  createSession,
  destroySession,
  getCustomer,
  hashPassword,
  rateLimit,
  resetRateLimit,
  verifyAgainstDummy,
  verifyPassword,
} from "@/lib/auth";
import { getProductsByIds, type ProductCard } from "@/lib/catalog";
import { normalizePhone } from "@/lib/format";
import { createOrder, notifyNewOrder } from "@/lib/orders";
import { clickCheckoutUrl } from "@/lib/payments/click";
import { paymeCheckoutUrl } from "@/lib/payments/payme";
import { quoteCart, quoteInputSchema, type Quote } from "@/lib/quote";
import { siteUrl } from "@/lib/settings";
import { saveImage, UploadError } from "@/lib/storage";
import { sendTelegram } from "@/lib/telegram";
import { CONSENT_TEXT, type FormState } from "@/lib/form-state";
import { isISODate } from "@/lib/time";

/* ------------------------------------------------------------------ */
/* Cart & checkout                                                     */
/* ------------------------------------------------------------------ */

export async function quoteAction(input: unknown): Promise<{ ok: true; quote: Quote } | { ok: false; error: string }> {
  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Savat ma’lumotlari noto‘g‘ri. Sahifani yangilang." };
  try {
    return { ok: true, quote: await quoteCart(parsed.data) };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Hisoblashda xatolik yuz berdi. Qayta urinib ko‘ring." };
  }
}

export type CheckoutResult =
  | { ok: true; redirectTo: string }
  | { ok: false; errors: string[]; fieldErrors?: Record<string, string> };

export async function checkoutAction(input: unknown): Promise<CheckoutResult> {
  const ip = await clientIp();
  if (!(await rateLimit(`checkout:${ip}`, 15, 600))) {
    return { ok: false, errors: ["Juda ko‘p urinish. Iltimos, birozdan so‘ng qayta urinib ko‘ring."] };
  }
  const customer = await getCustomer();
  try {
    const res = await createOrder(input, customer?.id ?? null);
    if (!res.ok) return { ok: false, errors: res.errors, fieldErrors: res.fieldErrors };
    // Owner notification runs after the response; its real outcome is logged on the order.
    after(() => notifyNewOrder(res.orderId));

    const orderUrl = `/buyurtma/${res.number}?t=${res.accessToken}&yangi=1`;
    if (res.paymentMethod === "cash") return { ok: true, redirectTo: orderUrl };

    const db = await getDb();
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, res.orderId));
    const returnUrl = siteUrl() + orderUrl;
    const providerUrl =
      res.paymentMethod === "payme" ? paymeCheckoutUrl(order.number, order.total, returnUrl) : clickCheckoutUrl(order.number, order.total, returnUrl);
    // If the provider URL cannot be built the order still exists; the customer sees it with "payment pending".
    return { ok: true, redirectTo: providerUrl ?? orderUrl };
  } catch (e) {
    console.error("checkout failed", e);
    return { ok: false, errors: ["Buyurtmani saqlashda xatolik yuz berdi. Buyurtma yaratilmadi — qayta urinib ko‘ring."] };
  }
}

/** Fresh payment URL for an existing unpaid online order (e.g. customer closed the payment page). */
export async function retryPaymentAction(number: string, token: string): Promise<string | null> {
  const db = await getDb();
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.number, number));
  if (!o || o.accessToken !== token || o.paymentStatus === "paid" || o.status === "cancelled" || o.status === "rejected") return null;
  const returnUrl = `${siteUrl()}/buyurtma/${o.number}?t=${o.accessToken}`;
  if (o.paymentMethod === "payme") return paymeCheckoutUrl(o.number, o.total, returnUrl);
  if (o.paymentMethod === "click") return clickCheckoutUrl(o.number, o.total, returnUrl);
  return null;
}

/* ------------------------------------------------------------------ */
/* Catalog helpers for client widgets                                  */
/* ------------------------------------------------------------------ */

export async function productCardsAction(ids: unknown): Promise<ProductCard[]> {
  const parsed = z.array(z.number().int().positive()).max(100).safeParse(ids);
  if (!parsed.success) return [];
  return getProductsByIds(parsed.data);
}

/* ------------------------------------------------------------------ */
/* Favorites                                                           */
/* ------------------------------------------------------------------ */

export async function syncFavoritesAction(localIds: unknown): Promise<number[] | null> {
  const customer = await getCustomer();
  if (!customer) return null;
  const ids = z.array(z.number().int().positive()).max(100).safeParse(localIds);
  const db = await getDb();
  if (ids.success && ids.data.length) {
    const existing = await db.select({ id: schema.products.id }).from(schema.products).where(inArray(schema.products.id, ids.data));
    if (existing.length) {
      await db
        .insert(schema.favorites)
        .values(existing.map((p) => ({ customerId: customer.id, productId: p.id })))
        .onConflictDoNothing();
    }
  }
  const rows = await db.select({ id: schema.favorites.productId }).from(schema.favorites).where(eq(schema.favorites.customerId, customer.id));
  return rows.map((r) => r.id);
}

export async function setFavoriteAction(productId: number, on: boolean) {
  const customer = await getCustomer();
  if (!customer || !Number.isInteger(productId)) return;
  const db = await getDb();
  if (on) {
    const [p] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.id, productId));
    if (p) await db.insert(schema.favorites).values({ customerId: customer.id, productId }).onConflictDoNothing();
  } else {
    await db.delete(schema.favorites).where(and(eq(schema.favorites.customerId, customer.id), eq(schema.favorites.productId, productId)));
  }
}

/* ------------------------------------------------------------------ */
/* Newsletter (explicit consent)                                       */
/* ------------------------------------------------------------------ */



export async function subscribeAction(_: FormState, form: FormData): Promise<FormState> {
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  if (!phone) return { ok: false, errors: { phone: "Telefon raqami noto‘g‘ri" } };
  if (form.get("consent") !== "on") return { ok: false, errors: { consent: "Obuna uchun roziligingiz kerak" } };
  if (!(await rateLimit(`sub:${await clientIp()}`, 5, 3600))) return { ok: false, message: "Juda ko‘p urinish" };
  const db = await getDb();
  await db
    .insert(schema.subscribers)
    .values({ phone, consentText: CONSENT_TEXT })
    .onConflictDoUpdate({ target: schema.subscribers.phone, set: { consentAt: new Date(), unsubscribedAt: null, consentText: CONSENT_TEXT } });
  return { ok: true, message: "Rahmat! Obuna bo‘ldingiz." };
}

/* ------------------------------------------------------------------ */
/* Custom bouquet request                                              */
/* ------------------------------------------------------------------ */

export async function customRequestAction(_: FormState, form: FormData): Promise<FormState> {
  const errors: Record<string, string> = {};
  const name = String(form.get("name") ?? "").trim();
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  const description = String(form.get("description") ?? "").trim();
  const occasion = String(form.get("occasion") ?? "").trim().slice(0, 80);
  const colors = String(form.get("colors") ?? "").trim().slice(0, 120);
  const budgetRaw = String(form.get("budget") ?? "").replace(/\D/g, "");
  const budget = budgetRaw ? Math.min(Number(budgetRaw), 100_000_000) : null;
  const date = String(form.get("date") ?? "");

  if (name.length < 2) errors.name = "Ismingizni kiriting";
  if (!phone) errors.phone = "Telefon raqami noto‘g‘ri";
  if (description.length < 10) errors.description = "Qanday guldasta xohlayotganingizni batafsilroq yozing";
  if (description.length > 2000) errors.description = "Matn juda uzun";
  if (date && !isISODate(date)) errors.date = "Sana noto‘g‘ri";
  if (Object.keys(errors).length) return { ok: false, errors };

  if (!(await rateLimit(`custom:${await clientIp()}`, 5, 3600))) return { ok: false, message: "Juda ko‘p so‘rov. Keyinroq urinib ko‘ring." };

  let imagePath: string | null = null;
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      imagePath = await saveImage(file, "requests");
    } catch (e) {
      if (e instanceof UploadError) return { ok: false, errors: { image: e.message } };
      throw e;
    }
  }

  const db = await getDb();
  const [row] = await db
    .insert(schema.customRequests)
    .values({ name, phone: phone!, description, occasion, colors, budget, desiredDate: date || null, imagePath })
    .returning();
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Sent after the response so a slow Telegram API never delays the customer.
  after(async () => {
    const r = await sendTelegram(
      `<b>💐 Maxsus guldasta so‘rovi #${row.id}</b>\n${esc(name)}, ${phone}\nMunosabat: ${esc(occasion) || "—"}\nByudjet: ${budget ?? "—"}\nSana: ${date || "—"}\nRanglar: ${esc(colors) || "—"}\n\n${esc(description.slice(0, 1500))}\n\n${siteUrl()}/admin/sorovlar`,
    );
    await db.insert(schema.notifications).values({ channel: "telegram", status: r.status, detail: `custom_request:${row.id} ${r.detail}` });
  });
  return { ok: true, message: "So‘rovingiz qabul qilindi. Floristimiz tez orada siz bilan bog‘lanadi." };
}

/* ------------------------------------------------------------------ */
/* Customer accounts                                                   */
/* ------------------------------------------------------------------ */

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get("name") ?? "").trim();
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  const password = String(form.get("password") ?? "");
  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Ismingizni kiriting";
  if (!phone) errors.phone = "Telefon raqami noto‘g‘ri";
  if (password.length < 8) errors.password = "Parol kamida 8 belgidan iborat bo‘lsin";
  if (Object.keys(errors).length) return { ok: false, errors };
  if (!(await rateLimit(`register:${await clientIp()}`, 5, 3600))) return { ok: false, message: "Juda ko‘p urinish. Keyinroq urinib ko‘ring." };

  const db = await getDb();
  const [exists] = await db.select({ id: schema.customers.id }).from(schema.customers).where(eq(schema.customers.phone, phone!));
  if (exists) return { ok: false, errors: { phone: "Bu raqam bilan hisob mavjud. Kirish sahifasidan foydalaning." } };
  const [c] = await db.insert(schema.customers).values({ name, phone: phone!, passwordHash: await hashPassword(password) }).returning();
  // Guest orders are NOT linked by phone: phone ownership is not verified (no SMS OTP).
  await createSession("customer", c.id);
  redirect(safeNext(form.get("next")));
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!phone || !password) return { ok: false, message: "Telefon raqami va parolni kiriting" };
  const key = `login:${phone}`;
  if (!(await rateLimit(key, 6, 900))) return { ok: false, message: "Juda ko‘p noto‘g‘ri urinish. 15 daqiqadan so‘ng qayta urinib ko‘ring." };
  const db = await getDb();
  const [c] = await db.select().from(schema.customers).where(eq(schema.customers.phone, phone));
  const ok = c ? await verifyPassword(password, c.passwordHash) : await verifyAgainstDummy(password);
  if (!c || !ok) return { ok: false, message: "Telefon raqami yoki parol noto‘g‘ri" };
  await resetRateLimit(key);
  await createSession("customer", c.id);
  redirect(safeNext(form.get("next")));
}

/** Only same-site relative paths are allowed as post-login redirects. */
function safeNext(v: FormDataEntryValue | null) {
  const next = String(v ?? "");
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/hisob";
}

export async function logoutAction() {
  await destroySession("customer");
  redirect("/");
}

export async function deleteAddressAction(id: number) {
  const customer = await getCustomer();
  if (!customer) return;
  const db = await getDb();
  await db.delete(schema.customerAddresses).where(and(eq(schema.customerAddresses.id, id), eq(schema.customerAddresses.customerId, customer.id)));
}
