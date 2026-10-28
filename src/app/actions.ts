"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { getLocale } from "@/i18n/server";
import {
  clientIp,
  createSession,
  deleteCustomerAccount,
  destroySession,
  getCustomer,
  hashPassword,
  rateLimit,
  resetRateLimit,
  verifyAgainstDummy,
  verifyPassword,
} from "@/lib/auth";
import { getProductsByIds, type ProductCard } from "@/lib/catalog";
import type { FormState } from "@/lib/form-state";
import { normalizePhone } from "@/lib/format";
import { createOrder, notifyNewOrder } from "@/lib/orders";
import { clickCheckoutUrl } from "@/lib/payments/click";
import { paymeCheckoutUrl } from "@/lib/payments/payme";
import { quoteCart, quoteInputSchema, type Quote } from "@/lib/quote";
import { siteUrl } from "@/lib/settings";
import { saveImage, UploadError } from "@/lib/storage";
import { sendTelegram } from "@/lib/telegram";
import { isISODate } from "@/lib/time";

/* All actions read the storefront language from the request (set by the proxy from the page URL). */

/* ------------------------------------------------------------------ */
/* Cart & checkout                                                     */
/* ------------------------------------------------------------------ */

export async function quoteAction(input: unknown): Promise<{ ok: true; quote: Quote } | { ok: false; error: string }> {
  const locale = await getLocale();
  const e = getDict(locale).errors.form;
  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: e.quoteInvalid };
  try {
    return { ok: true, quote: await quoteCart(parsed.data, { locale }) };
  } catch (err) {
    console.error(err);
    return { ok: false, error: e.quoteFailed };
  }
}

export type CheckoutResult =
  | { ok: true; redirectTo: string }
  | { ok: false; errors: string[]; fieldErrors?: Record<string, string> };

function orderPath(locale: Locale, number: string, token: string, fresh = false) {
  return localePath(locale, `/buyurtma/${number}?t=${token}${fresh ? "&yangi=1" : ""}`);
}

export async function checkoutAction(input: unknown): Promise<CheckoutResult> {
  const locale = await getLocale();
  const e = getDict(locale).errors.checkout;
  const ip = await clientIp();
  if (!(await rateLimit(`checkout:${ip}`, 15, 600))) return { ok: false, errors: [e.tooMany] };
  const customer = await getCustomer();
  try {
    const res = await createOrder(input, customer?.id ?? null, locale);
    if (!res.ok) return { ok: false, errors: res.errors, fieldErrors: res.fieldErrors };
    // Owner notification runs after the response; its real outcome is logged on the order.
    after(() => notifyNewOrder(res.orderId));

    const orderUrl = orderPath(locale, res.number, res.accessToken, true);
    if (res.paymentMethod === "cash") return { ok: true, redirectTo: orderUrl };

    const db = await getDb();
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, res.orderId));
    const returnUrl = siteUrl() + orderUrl;
    const providerUrl =
      res.paymentMethod === "payme" ? paymeCheckoutUrl(order.number, order.total, returnUrl) : clickCheckoutUrl(order.number, order.total, returnUrl);
    // If the provider URL cannot be built the order still exists; the customer sees it with "payment pending".
    return { ok: true, redirectTo: providerUrl ?? orderUrl };
  } catch (err) {
    console.error("checkout failed", err);
    return { ok: false, errors: [e.saveFailed] };
  }
}

/** Fresh payment URL for an existing unpaid online order (e.g. customer closed the payment page). */
export async function retryPaymentAction(number: string, token: string): Promise<string | null> {
  const db = await getDb();
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.number, number));
  if (!o || o.accessToken !== token || o.paymentStatus === "paid" || o.status === "cancelled" || o.status === "rejected") return null;
  const returnUrl = siteUrl() + orderPath(isLocale(o.locale) ? o.locale : "uz", o.number, o.accessToken);
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
  return getProductsByIds(parsed.data, await getLocale());
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
  const dict = getDict(await getLocale());
  const t = dict.home.newsletter;
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  if (!phone) return { ok: false, errors: { phone: dict.errors.form.phone } };
  if (form.get("consent") !== "on") return { ok: false, errors: { consent: t.consentRequired } };
  if (!(await rateLimit(`sub:${await clientIp()}`, 5, 3600))) return { ok: false, message: dict.errors.form.tooManyHour };
  const db = await getDb();
  // The exact text the person agreed to, in the language it was shown in.
  await db
    .insert(schema.subscribers)
    .values({ phone, consentText: t.consent })
    .onConflictDoUpdate({ target: schema.subscribers.phone, set: { consentAt: new Date(), unsubscribedAt: null, consentText: t.consent } });
  return { ok: true, message: t.ok };
}

/* ------------------------------------------------------------------ */
/* Custom bouquet request                                              */
/* ------------------------------------------------------------------ */

export async function customRequestAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const dict = getDict(locale);
  const e = dict.errors.form;
  const errors: Record<string, string> = {};
  const name = String(form.get("name") ?? "").trim();
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  const description = String(form.get("description") ?? "").trim();
  const occasion = String(form.get("occasion") ?? "").trim().slice(0, 80);
  const colors = String(form.get("colors") ?? "").trim().slice(0, 120);
  const budgetRaw = String(form.get("budget") ?? "").replace(/\D/g, "");
  const budget = budgetRaw ? Math.min(Number(budgetRaw), 100_000_000) : null;
  const date = String(form.get("date") ?? "");

  if (name.length < 2) errors.name = e.name;
  if (!phone) errors.phone = e.phone;
  if (description.length < 10) errors.description = e.description;
  if (description.length > 2000) errors.description = e.descriptionLong;
  if (date && !isISODate(date)) errors.date = e.date;
  if (Object.keys(errors).length) return { ok: false, errors };

  if (!(await rateLimit(`custom:${await clientIp()}`, 5, 3600))) return { ok: false, message: e.tooManyRequests };

  let imagePath: string | null = null;
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      imagePath = await saveImage(file, "requests");
    } catch (err) {
      if (err instanceof UploadError) return { ok: false, errors: { image: dict.errors.upload[err.code] } };
      throw err;
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
      `<b>💐 Maxsus guldasta so‘rovi #${row.id}</b>${locale === "ru" ? " (rus tilida)" : ""}\n${esc(name)}, ${phone}\nMunosabat: ${esc(occasion) || "—"}\nByudjet: ${budget ?? "—"}\nSana: ${date || "—"}\nRanglar: ${esc(colors) || "—"}\n\n${esc(description.slice(0, 1500))}\n\n${siteUrl()}/admin/sorovlar`,
    );
    await db.insert(schema.notifications).values({ channel: "telegram", status: r.status, detail: `custom_request:${row.id} ${r.detail}` });
  });
  return { ok: true, message: dict.custom.ok };
}

/* ------------------------------------------------------------------ */
/* Customer accounts                                                   */
/* ------------------------------------------------------------------ */

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const e = getDict(locale).errors.form;
  const name = String(form.get("name") ?? "").trim();
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  const password = String(form.get("password") ?? "");
  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = e.name;
  if (!phone) errors.phone = e.phone;
  if (password.length < 8) errors.password = e.password;
  if (Object.keys(errors).length) return { ok: false, errors };
  if (!(await rateLimit(`register:${await clientIp()}`, 5, 3600))) return { ok: false, message: e.tooManyLater };

  const db = await getDb();
  const [exists] = await db.select({ id: schema.customers.id }).from(schema.customers).where(eq(schema.customers.phone, phone!));
  if (exists) return { ok: false, errors: { phone: e.phoneTaken } };
  const [c] = await db.insert(schema.customers).values({ name, phone: phone!, passwordHash: await hashPassword(password) }).returning();
  // Guest orders are NOT linked by phone: phone ownership is not verified (no SMS OTP).
  await createSession("customer", c.id);
  redirect(safeNext(form.get("next"), locale));
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const e = getDict(locale).errors.form;
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!phone || !password) return { ok: false, message: e.loginRequired };
  const key = `login:${phone}`;
  if (!(await rateLimit(key, 6, 900))) return { ok: false, message: e.tooMany15 };
  const db = await getDb();
  const [c] = await db.select().from(schema.customers).where(eq(schema.customers.phone, phone));
  const ok = c ? await verifyPassword(password, c.passwordHash) : await verifyAgainstDummy(password);
  if (!c || !ok) return { ok: false, message: e.loginFailed };
  await resetRateLimit(key);
  await createSession("customer", c.id);
  redirect(safeNext(form.get("next"), locale));
}

/** Only same-site relative paths are allowed as post-login redirects. */
function safeNext(v: FormDataEntryValue | null, locale: Locale) {
  const next = String(v ?? "");
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : localePath(locale, "/hisob");
}

export async function logoutAction() {
  const locale = await getLocale();
  await destroySession("customer");
  redirect(localePath(locale, "/"));
}

/** Self-service account deletion: needs the current password and an explicit confirmation. */
export async function deleteAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = getDict(locale).account.deleteAccount;
  const customer = await getCustomer();
  if (!customer) redirect(localePath(locale, "/hisob") + "?next=" + encodeURIComponent(localePath(locale, "/hisobni-ochirish")));
  const errors: Record<string, string> = {};
  if (form.get("confirm") !== "on") errors.confirm = t.confirmRequired;
  const password = String(form.get("password") ?? "");
  if (!password) errors.password = t.passwordRequired;
  if (Object.keys(errors).length) return { ok: false, errors };
  const key = `delete-account:${customer.id}`;
  if (!(await rateLimit(key, 5, 900))) return { ok: false, message: getDict(locale).errors.form.tooMany15 };
  const db = await getDb();
  const [row] = await db.select({ hash: schema.customers.passwordHash }).from(schema.customers).where(eq(schema.customers.id, customer.id));
  if (!row || !(await verifyPassword(password, row.hash))) return { ok: false, errors: { password: t.wrongPassword } };
  await deleteCustomerAccount(customer.id);
  await destroySession("customer");
  await resetRateLimit(key);
  redirect(localePath(locale, "/hisobni-ochirish") + "?ochirildi=1");
}

export async function deleteAddressAction(id: number) {
  const customer = await getCustomer();
  if (!customer) return;
  const db = await getDb();
  await db.delete(schema.customerAddresses).where(and(eq(schema.customerAddresses.id, id), eq(schema.customerAddresses.customerId, customer.id)));
}
