"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import {
  clientIp,
  createSession,
  destroySession,
  rateLimit,
  requireAdmin,
  requireOwner,
  resetRateLimit,
  verifyAgainstDummy,
  verifyPassword,
} from "@/lib/auth";
import { normalizePhone, slugify } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import { changeOrderStatus, type Order } from "@/lib/orders";
import { DEFAULT_CHECKOUT, DEFAULT_STORE, getSettings, saveSetting } from "@/lib/settings";
import { saveImage, UploadError } from "@/lib/storage";
import { notifyOrder, sendTelegram } from "@/lib/telegram";
import { isISODate } from "@/lib/time";
import { parseCsv, PRODUCT_CSV_COLUMNS } from "@/lib/csv";
import { buildSearchText } from "@/lib/search";

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export async function adminLoginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { message: "Email va parolni kiriting" };
  const ip = await clientIp();
  const key = `admin-login:${email}`;
  if (!(await rateLimit(key, 5, 900)) || !(await rateLimit(`admin-login-ip:${ip}`, 20, 900))) {
    return { message: "Juda ko‘p urinish. 15 daqiqadan so‘ng qayta urinib ko‘ring." };
  }
  const db = await getDb();
  const [a] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email));
  const ok = a && a.isActive ? await verifyPassword(password, a.passwordHash) : await verifyAgainstDummy(password);
  if (!a || !a.isActive || !ok) return { message: "Email yoki parol noto‘g‘ri" };
  await resetRateLimit(key);
  await db.update(schema.adminUsers).set({ lastLoginAt: new Date() }).where(eq(schema.adminUsers.id, a.id));
  await createSession("admin", a.id);
  redirect("/admin");
}

export async function adminLogoutAction() {
  await destroySession("admin");
  redirect("/admin/kirish");
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */


export async function setOrderStatusAction(orderId: string, to: Order["status"], form: FormData) {
  const admin = await requireAdmin();
  const reason = String(form.get("reason") ?? "").trim().slice(0, 300);
  await changeOrderStatus(orderId, to, admin.email, reason);
  revalidatePath(`/admin/buyurtmalar/${orderId}`);
}

export async function setPaymentStatusAction(orderId: string, form: FormData) {
  const admin = await requireAdmin();
  const status = z.enum(["pending", "paid", "failed", "cancelled", "refunded"]).safeParse(form.get("paymentStatus"));
  if (!status.success) return;
  const db = await getDb();
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  // Online payments are confirmed by provider callbacks; manual changes are only allowed for cash orders
  // (or refunds recorded by the owner).
  if (!o || (o.paymentMethod !== "cash" && status.data !== "refunded")) return;
  await db.update(schema.orders).set({ paymentStatus: status.data, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
  await db.insert(schema.orderEvents).values({ orderId, type: "payment", message: `To‘lov holati qo‘lda o‘zgartirildi: ${status.data}`, actor: admin.email });
  revalidatePath(`/admin/buyurtmalar/${orderId}`);
}

const deliveryEditSchema = z.object({
  deliveryDate: z.string().refine(isISODate, "Sana noto‘g‘ri"),
  slotId: z.coerce.number().int().positive(),
  recipientName: z.string().trim().min(2).max(80),
  recipientPhone: z.string().trim().min(9).max(30),
  district: z.string().trim().max(80),
  neighborhood: z.string().trim().max(80),
  address: z.string().trim().max(200),
  apartment: z.string().trim().max(40),
  landmark: z.string().trim().max(160),
  courierNote: z.string().trim().max(500),
  adminNote: z.string().trim().max(1000),
});

export async function updateOrderDeliveryAction(orderId: string, _: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = deliveryEditSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const db = await getDb();
  const [slot] = await db.select().from(schema.timeSlots).where(eq(schema.timeSlots.id, parsed.data.slotId));
  if (!slot) return { ok: false, message: "Vaqt oralig‘i topilmadi" };
  const { slotId, ...rest } = parsed.data;
  await db
    .update(schema.orders)
    .set({ ...rest, slotId, slotLabel: slot.label, updatedAt: new Date() })
    .where(eq(schema.orders.id, orderId));
  await db.insert(schema.orderEvents).values({ orderId, type: "edit", message: "Yetkazib berish ma’lumotlari yangilandi", actor: admin.email });
  revalidatePath(`/admin/buyurtmalar/${orderId}`);
  return { ok: true, message: "Saqlandi" };
}

export async function resendTelegramAction(orderId: string) {
  await requireAdmin();
  const db = await getDb();
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!o) return;
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  await notifyOrder({ ...o, items }, "🔁 Buyurtma (qayta yuborildi)");
  revalidatePath(`/admin/buyurtmalar/${orderId}`);
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

const int = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[\s ]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : NaN;
};
const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

export async function saveProductAction(productId: number | null, _: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const db = await getDb();
  const errors: Record<string, string> = {};

  const name = String(form.get("name") ?? "").trim();
  const slug = slugify(String(form.get("slug") ?? "") || name);
  const pricingMode = z.enum(["fixed", "variants", "per_stem"]).catch("fixed").parse(form.get("pricingMode"));
  const price = int(form.get("price")) ?? 0;
  const compareAtPrice = int(form.get("compareAtPrice"));
  const stemPrice = int(form.get("stemPrice"));
  const minStems = int(form.get("minStems"));
  const maxStems = int(form.get("maxStems"));
  const stemStep = int(form.get("stemStep")) ?? 1;
  const stockQuantity = int(form.get("stockQuantity"));
  const prepTimeMinutes = int(form.get("prepTimeMinutes")) ?? 60;
  const stemCount = int(form.get("stemCount"));
  const seasonalMonths = form.getAll("seasonalMonths").map(Number).filter((m) => m >= 1 && m <= 12);
  const categoryIds = form.getAll("categoryIds").map(Number).filter(Number.isInteger);
  const primaryCategoryId = int(form.get("primaryCategoryId"));

  if (name.length < 2) errors.name = "Nomini kiriting";
  if (!slug) errors.slug = "Slug noto‘g‘ri";
  for (const [k, v] of Object.entries({ price, compareAtPrice, stemPrice, minStems, maxStems, stockQuantity, prepTimeMinutes, stemCount })) {
    if (v != null && (Number.isNaN(v) || v < 0)) errors[k] = "Butun musbat son kiriting";
  }
  if (pricingMode === "fixed" && !(price > 0)) errors.price = "Narxni kiriting";
  if (pricingMode === "per_stem") {
    if (!stemPrice || stemPrice <= 0) errors.stemPrice = "Bir dona narxini kiriting";
    if (!minStems || !maxStems || minStems > maxStems) errors.minStems = "Min/max sonlarni to‘g‘ri kiriting";
  }

  // Variants: rows variant_id[], variant_name[], variant_stems[], variant_price[], variant_compare[], variant_stock[], variant_active[]
  const vIds = form.getAll("variant_id").map(String);
  const variants = vIds
    .map((id, i) => ({
      id: id ? Number(id) : null,
      name: String(form.getAll("variant_name")[i] ?? "").trim(),
      nameRu: String(form.getAll("variant_name_ru")[i] ?? "").trim() || null,
      stemCount: int(form.getAll("variant_stems")[i] ?? null),
      price: int(form.getAll("variant_price")[i] ?? null),
      compareAtPrice: int(form.getAll("variant_compare")[i] ?? null),
      stockQuantity: int(form.getAll("variant_stock")[i] ?? null),
      isActive: form.getAll("variant_active").map(String).includes(String(i)),
      sortOrder: i,
    }))
    .filter((v) => v.name || v.price);
  if (pricingMode === "variants") {
    if (!variants.length) errors.variants = "Kamida bitta o‘lcham kiriting";
    if (variants.some((v) => !v.name || !v.price || v.price <= 0 || Number.isNaN(v.price))) errors.variants = "Har bir o‘lcham uchun nom va narx kiriting";
  }

  // Images: keep existing (in order), remove unchecked, append uploads.
  const keepUrls = form.getAll("keepImage").map(String);
  const alts = new Map(keepUrls.map((u, i) => [u, String(form.getAll("keepImageAlt")[i] ?? "")]));
  let existing: (typeof schema.products.$inferSelect)["images"] = [];
  if (productId) {
    const [row] = await db.select({ images: schema.products.images }).from(schema.products).where(eq(schema.products.id, productId));
    existing = row?.images ?? [];
  }
  const images = existing.filter((img) => keepUrls.includes(img.url)).map((img) => ({ ...img, alt: alts.get(img.url) || img.alt }));
  for (const file of form.getAll("newImages")) {
    if (!(file instanceof File) || file.size === 0) continue;
    try {
      images.push({ url: await saveImage(file, "products"), alt: name });
    } catch (e) {
      if (e instanceof UploadError) errors.newImages = e.message;
      else throw e;
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors, message: "Xatolarni to‘g‘rilang" };

  const [dup] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.slug, slug));
  if (dup && dup.id !== productId) return { ok: false, errors: { slug: "Bu slug band" } };

  const shortDescription = String(form.get("shortDescription") ?? "").trim();
  const flowerVarieties = lines(form.get("flowerVarieties"));
  const ru = {
    nameRu: String(form.get("nameRu") ?? "").trim() || null,
    shortDescriptionRu: String(form.get("shortDescriptionRu") ?? "").trim() || null,
    descriptionRu: String(form.get("descriptionRu") ?? "").trim() || null,
    careInstructionsRu: String(form.get("careInstructionsRu") ?? "").trim() || null,
    sizeLabelRu: String(form.get("sizeLabelRu") ?? "").trim() || null,
    flowerVarietiesRu: lines(form.get("flowerVarietiesRu")),
    colorOptionsRu: lines(form.get("colorOptionsRu")),
    seoTitleRu: String(form.get("seoTitleRu") ?? "").trim() || null,
    seoDescriptionRu: String(form.get("seoDescriptionRu") ?? "").trim() || null,
  };
  const values = {
    name,
    slug,
    shortDescription,
    description: String(form.get("description") ?? "").trim(),
    careInstructions: String(form.get("careInstructions") ?? "").trim(),
    flowerVarieties,
    colorOptions: lines(form.get("colorOptions")),
    ...ru,
    searchText: buildSearchText({ name, shortDescription, flowerVarieties, ...ru }),
    stemCount,
    sizeLabel: String(form.get("sizeLabel") ?? "").trim() || null,
    primaryCategoryId: primaryCategoryId && categoryIds.includes(primaryCategoryId) ? primaryCategoryId : (categoryIds[0] ?? null),
    images,
    pricingMode,
    price: pricingMode === "fixed" ? price : (price || 0),
    compareAtPrice,
    stemPrice: pricingMode === "per_stem" ? stemPrice : null,
    minStems: pricingMode === "per_stem" ? minStems : null,
    maxStems: pricingMode === "per_stem" ? maxStems : null,
    stemStep: Math.max(1, stemStep),
    status: z.enum(["active", "draft", "archived"]).catch("draft").parse(form.get("status")),
    availability: z.enum(["in_stock", "made_to_order", "out_of_stock"]).catch("in_stock").parse(form.get("availability")),
    stockQuantity,
    seasonalMonths,
    prepTimeMinutes,
    deliveryEligible: form.get("deliveryEligible") === "on",
    pickupEligible: form.get("pickupEligible") === "on",
    isAddon: form.get("isAddon") === "on",
    isDemo: form.get("isDemo") === "on",
    isFeatured: form.get("isFeatured") === "on",
    isNew: form.get("isNew") === "on",
    isPremium: form.get("isPremium") === "on",
    seoTitle: String(form.get("seoTitle") ?? "").trim() || null,
    seoDescription: String(form.get("seoDescription") ?? "").trim() || null,
    updatedAt: new Date(),
  };

  const id = await db.transaction(async (tx) => {
    let pid = productId;
    if (pid) {
      const [before] = await tx.select().from(schema.products).where(eq(schema.products.id, pid));
      const beforeVariants = await tx.select().from(schema.productVariants).where(eq(schema.productVariants.productId, pid));
      const priceChanged =
        before.price !== values.price ||
        before.stemPrice !== values.stemPrice ||
        before.compareAtPrice !== values.compareAtPrice ||
        JSON.stringify(beforeVariants.map((v) => [v.id, v.price])) !== JSON.stringify(variants.filter((v) => v.id).map((v) => [v.id, v.price])) ||
        variants.some((v) => !v.id);
      await tx
        .update(schema.products)
        .set({ ...values, ...(priceChanged ? { priceUpdatedAt: new Date() } : {}) })
        .where(eq(schema.products.id, pid));
    } else {
      const [row] = await tx.insert(schema.products).values({ ...values, priceUpdatedAt: new Date() }).returning({ id: schema.products.id });
      pid = row.id;
    }
    // Variants: update existing, insert new, remove deleted.
    const current = await tx.select({ id: schema.productVariants.id }).from(schema.productVariants).where(eq(schema.productVariants.productId, pid));
    const keep = new Set(variants.filter((v) => v.id).map((v) => v.id));
    for (const c of current) if (!keep.has(c.id)) await tx.delete(schema.productVariants).where(eq(schema.productVariants.id, c.id));
    for (const v of variants) {
      const data = { name: v.name, nameRu: v.nameRu, stemCount: v.stemCount, price: v.price ?? 0, compareAtPrice: v.compareAtPrice, stockQuantity: v.stockQuantity, isActive: v.isActive, sortOrder: v.sortOrder };
      if (v.id && current.some((c) => c.id === v.id)) await tx.update(schema.productVariants).set(data).where(eq(schema.productVariants.id, v.id));
      else await tx.insert(schema.productVariants).values({ ...data, productId: pid });
    }
    await tx.delete(schema.productCategories).where(eq(schema.productCategories.productId, pid));
    if (categoryIds.length) await tx.insert(schema.productCategories).values(categoryIds.map((categoryId) => ({ productId: pid!, categoryId })));
    return pid;
  });

  revalidatePath("/admin/mahsulotlar");
  if (!productId) redirect(`/admin/mahsulotlar/${id}?saqlandi=1`);
  return { ok: true, message: "Saqlandi" };
}

/** Quick inline update from the products table. */
export async function quickUpdateProductAction(productId: number, form: FormData) {
  await requireAdmin();
  const db = await getDb();
  const price = int(form.get("price"));
  const stock = String(form.get("stockQuantity") ?? "").trim() === "" ? null : int(form.get("stockQuantity"));
  const status = z.enum(["active", "draft", "archived"]).safeParse(form.get("status"));
  const availability = z.enum(["in_stock", "made_to_order", "out_of_stock"]).safeParse(form.get("availability"));
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  if (!p) return;
  const patch: Partial<typeof schema.products.$inferInsert> = { updatedAt: new Date() };
  if (p.pricingMode === "fixed" && price != null && price > 0 && price !== p.price) {
    patch.price = price;
    patch.priceUpdatedAt = new Date();
  }
  if (stock === null || (Number.isInteger(stock) && stock >= 0)) patch.stockQuantity = stock;
  if (status.success) patch.status = status.data;
  if (availability.success) patch.availability = availability.data;
  await db.update(schema.products).set(patch).where(eq(schema.products.id, productId));
  revalidatePath("/admin/mahsulotlar");
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export async function saveCategoryAction(categoryId: number | null, _: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const slug = slugify(String(form.get("slug") ?? "") || name);
  const kind = z.enum(["flower", "bouquet_type", "occasion", "collection"]).safeParse(form.get("kind"));
  if (name.length < 2 || !slug || !kind.success) return { ok: false, message: "Nom, slug va turini to‘g‘ri kiriting" };
  const db = await getDb();
  const [dup] = await db.select({ id: schema.categories.id }).from(schema.categories).where(eq(schema.categories.slug, slug));
  if (dup && dup.id !== categoryId) return { ok: false, message: "Bu slug band" };
  const values = {
    name,
    slug,
    kind: kind.data,
    description: String(form.get("description") ?? "").trim(),
    nameRu: String(form.get("nameRu") ?? "").trim() || null,
    descriptionRu: String(form.get("descriptionRu") ?? "").trim() || null,
    seoTitleRu: String(form.get("seoTitleRu") ?? "").trim() || null,
    seoDescriptionRu: String(form.get("seoDescriptionRu") ?? "").trim() || null,
    imageUrl: String(form.get("imageUrl") ?? "").trim() || null,
    sortOrder: int(form.get("sortOrder")) || 0,
    isActive: form.get("isActive") === "on",
    seoTitle: String(form.get("seoTitle") ?? "").trim() || null,
    seoDescription: String(form.get("seoDescription") ?? "").trim() || null,
  };
  if (categoryId) await db.update(schema.categories).set(values).where(eq(schema.categories.id, categoryId));
  else await db.insert(schema.categories).values(values);
  revalidatePath("/admin/kategoriyalar");
  return { ok: true, message: "Saqlandi" };
}

/* ------------------------------------------------------------------ */
/* Delivery                                                            */
/* ------------------------------------------------------------------ */

export async function saveRegionAction(regionId: number | null, _: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, message: "Nomini kiriting" };
  const db = await getDb();
  const values = {
    name,
    slug: slugify(String(form.get("slug") ?? "") || name),
    isActive: form.get("isActive") === "on",
    sortOrder: int(form.get("sortOrder")) || 0,
    note: String(form.get("note") ?? "").trim(),
    nameRu: String(form.get("nameRu") ?? "").trim() || null,
  };
  if (regionId) await db.update(schema.deliveryRegions).set(values).where(eq(schema.deliveryRegions.id, regionId));
  else await db.insert(schema.deliveryRegions).values(values);
  revalidatePath("/admin/yetkazib-berish");
  return { ok: true, message: "Saqlandi" };
}

const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveZoneAction(zoneId: number | null, _: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const name = String(form.get("name") ?? "").trim();
  const regionId = int(form.get("regionId"));
  const fee = int(form.get("fee"));
  const cutoff = String(form.get("sameDayCutoff") ?? "18:00");
  const freeFrom = int(form.get("freeFrom"));
  const minOrder = int(form.get("minOrder"));
  const lead = int(form.get("minLeadMinutes")) ?? 120;
  if (name.length < 2 || !regionId || fee == null || Number.isNaN(fee) || fee < 0 || !hhmm.test(cutoff) || [freeFrom, minOrder, lead].some((x) => x != null && (Number.isNaN(x) || x < 0))) {
    return { ok: false, message: "Maydonlarni to‘g‘ri to‘ldiring (narxlar — butun son, vaqt — SS:DD)" };
  }
  const db = await getDb();
  const values = {
    regionId,
    name,
    description: String(form.get("description") ?? "").trim(),
    nameRu: String(form.get("nameRu") ?? "").trim() || null,
    descriptionRu: String(form.get("descriptionRu") ?? "").trim() || null,
    fee,
    freeFrom,
    minOrder,
    sameDayEnabled: form.get("sameDayEnabled") === "on",
    sameDayCutoff: cutoff,
    minLeadMinutes: lead,
    isActive: form.get("isActive") === "on",
    sortOrder: int(form.get("sortOrder")) || 0,
  };
  if (zoneId) await db.update(schema.deliveryZones).set(values).where(eq(schema.deliveryZones.id, zoneId));
  else await db.insert(schema.deliveryZones).values(values);
  revalidatePath("/admin/yetkazib-berish");
  return { ok: true, message: "Saqlandi" };
}

export async function saveSlotAction(slotId: number | null, _: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const start = String(form.get("startTime") ?? "");
  const end = String(form.get("endTime") ?? "");
  const capacity = int(form.get("capacity"));
  if (!hhmm.test(start) || !hhmm.test(end) || start >= end) return { ok: false, message: "Boshlanish va tugash vaqtini SS:DD formatida kiriting" };
  if (capacity != null && (Number.isNaN(capacity) || capacity < 1)) return { ok: false, message: "Sig‘im musbat son bo‘lsin" };
  const db = await getDb();
  const values = {
    label: String(form.get("label") ?? "").trim() || `${start} – ${end}`,
    startTime: start,
    endTime: end,
    capacity,
    isActive: form.get("isActive") === "on",
    sortOrder: int(form.get("sortOrder")) || 0,
  };
  if (slotId) await db.update(schema.timeSlots).set(values).where(eq(schema.timeSlots.id, slotId));
  else await db.insert(schema.timeSlots).values(values);
  revalidatePath("/admin/yetkazib-berish");
  return { ok: true, message: "Saqlandi" };
}

/* ------------------------------------------------------------------ */
/* Coupons                                                             */
/* ------------------------------------------------------------------ */

export async function saveCouponAction(couponId: number | null, _: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const type = z.enum(["percent", "fixed"]).safeParse(form.get("type"));
  const value = int(form.get("value"));
  const toDate = (v: FormDataEntryValue | null) => (String(v ?? "") ? new Date(`${v}T00:00:00+05:00`) : null);
  if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !type.success || !value || value <= 0 || (type.data === "percent" && value > 90)) {
    return { ok: false, message: "Kod (A-Z, 0-9), turi va qiymatini to‘g‘ri kiriting (foiz 90 dan oshmasin)" };
  }
  const db = await getDb();
  const values = {
    code,
    type: type.data,
    value,
    minSubtotal: int(form.get("minSubtotal")) || 0,
    maxDiscount: int(form.get("maxDiscount")),
    usageLimit: int(form.get("usageLimit")),
    startsAt: toDate(form.get("startsAt")),
    endsAt: toDate(form.get("endsAt")),
    isActive: form.get("isActive") === "on",
  };
  try {
    if (couponId) await db.update(schema.coupons).set(values).where(eq(schema.coupons.id, couponId));
    else await db.insert(schema.coupons).values(values);
  } catch {
    return { ok: false, message: "Bu kod band" };
  }
  revalidatePath("/admin/kuponlar");
  return { ok: true, message: "Saqlandi" };
}

/* ------------------------------------------------------------------ */
/* Custom requests                                                     */
/* ------------------------------------------------------------------ */

export async function setRequestStatusAction(id: number, status: "new" | "contacted" | "closed") {
  await requireAdmin();
  const db = await getDb();
  await db.update(schema.customRequests).set({ status }).where(eq(schema.customRequests.id, id));
  revalidatePath("/admin/sorovlar");
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export async function saveSettingsAction(_: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const n = (k: string, d: number) => {
    const v = int(form.get(k));
    return v == null || Number.isNaN(v) || v < 0 ? d : v;
  };
  const tgUser = s("telegramUsername").replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");
  if (tgUser && !/^[A-Za-z0-9_]{4,32}$/.test(tgUser)) return { ok: false, message: "Telegram username noto‘g‘ri" };
  const insta = s("instagramUrl");
  if (insta && !/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?$/.test(insta)) return { ok: false, message: "Instagram havolasi https://instagram.com/... ko‘rinishida bo‘lsin" };
  const phone = s("phone");
  if (phone && !normalizePhone(phone)) return { ok: false, message: "Telefon raqami noto‘g‘ri" };

  await saveSetting("store", {
    ...DEFAULT_STORE,
    name: s("name") || "Gulzor",
    tagline: s("tagline"),
    phone: phone ? normalizePhone(phone)! : "",
    email: s("email"),
    address: s("address"),
    telegramUsername: tgUser,
    instagramUrl: insta,
    workingHours: s("workingHours"),
    workingHoursRu: s("workingHoursRu"),
    addressRu: s("addressRu"),
    legalName: s("legalName"),
  });
  await saveSetting("checkout", {
    ...DEFAULT_CHECKOUT,
    serviceFee: n("serviceFee", 0),
    serviceFeeLabel: s("serviceFeeLabel") || "Xizmat haqi",
    serviceFeeLabelRu: s("serviceFeeLabelRu") || "Сервисный сбор",
    pickupAddressRu: s("pickupAddressRu"),
    pickupEnabled: form.get("pickupEnabled") === "on",
    pickupAddress: s("pickupAddress"),
    pickupPrepMinutes: n("pickupPrepMinutes", 60),
    cashEnabled: form.get("cashEnabled") === "on",
    couponsEnabled: form.get("couponsEnabled") === "on",
    maxDaysAhead: Math.min(n("maxDaysAhead", 30), 180),
    demoMode: form.get("demoMode") === "on",
    paymeEnabled: form.get("paymeEnabled") === "on",
    clickEnabled: form.get("clickEnabled") === "on",
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Sozlamalar saqlandi" };
}

export async function testTelegramAction(): Promise<FormState> {
  await requireOwner();
  const { store } = await getSettings();
  const r = await sendTelegram(`✅ ${store.name}: Telegram bildirishnomalari ishlayapti.`);
  const db = await getDb();
  await db.insert(schema.notifications).values({ channel: "telegram", status: r.status, detail: `test: ${r.detail}` });
  return { ok: r.status === "sent", message: r.status === "sent" ? "Test xabar yuborildi — Telegram’ni tekshiring." : `Yuborilmadi: ${r.detail}` };
}

/* ------------------------------------------------------------------ */
/* CSV import                                                          */
/* ------------------------------------------------------------------ */

export async function importProductsAction(_: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "CSV faylni tanlang" };
  if (file.size > 2 * 1024 * 1024) return { ok: false, message: "Fayl 2 MB dan oshmasin" };
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { ok: false, message: "Faylda ma’lumot yo‘q" };
  const header = rows[0].map((h) => h.trim());
  const missing = ["slug", "name", "price"].filter((c) => !header.includes(c));
  if (missing.length) return { ok: false, message: `Ustunlar yetishmaydi: ${missing.join(", ")}. Shablon: ${PRODUCT_CSV_COLUMNS.join(", ")}` };

  const db = await getDb();
  const cats = await db.select({ id: schema.categories.id, slug: schema.categories.slug }).from(schema.categories);
  const catId = new Map(cats.map((c) => [c.slug, c.id]));
  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  for (const [i, row] of rows.slice(1).entries()) {
    if (row.every((c) => !c.trim())) continue;
    const r = Object.fromEntries(header.map((h, j) => [h, (row[j] ?? "").trim()]));
    const ruCol = (k: string) => (header.includes(k) ? r[k] || null : undefined);
    const line = i + 2;
    const slug = slugify(r.slug || r.name);
    const price = Number(r.price.replace(/\s/g, ""));
    if (!slug || !r.name || !Number.isInteger(price) || price <= 0) {
      errors.push(`${line}-qator: slug, name va price (butun son) majburiy`);
      continue;
    }
    const stock = r.stock_quantity ? Number(r.stock_quantity) : null;
    if (stock != null && (!Number.isInteger(stock) || stock < 0)) {
      errors.push(`${line}-qator: stock_quantity noto‘g‘ri`);
      continue;
    }
    const categorySlugs = (r.categories || "").split("|").map((x) => x.trim()).filter(Boolean);
    const unknown = categorySlugs.filter((s) => !catId.has(s));
    if (unknown.length) {
      errors.push(`${line}-qator: noma’lum kategoriya(lar): ${unknown.join(", ")}`);
      continue;
    }
    const availability = (["in_stock", "made_to_order", "out_of_stock"] as const).find((a) => a === r.availability) ?? "in_stock";
    const status = (["active", "draft", "archived"] as const).find((a) => a === r.status) ?? "draft";
    const compare = r.compare_at_price ? Number(r.compare_at_price) : null;
    const values = {
      slug,
      name: r.name,
      shortDescription: r.short_description ?? "",
      description: r.description ?? "",
      careInstructions: r.care_instructions ?? "",
      flowerVarieties: (r.flower_varieties || "").split("|").map((x) => x.trim()).filter(Boolean),
      // Russian columns are optional: only touch them when the CSV has them (older files must not wipe translations).
      nameRu: ruCol("name_ru"),
      shortDescriptionRu: ruCol("short_description_ru"),
      descriptionRu: ruCol("description_ru"),
      careInstructionsRu: ruCol("care_instructions_ru"),
      stemCount: r.stem_count ? Number(r.stem_count) || null : null,
      sizeLabel: r.size_label || null,
      price,
      compareAtPrice: compare && Number.isInteger(compare) ? compare : null,
      pricingMode: "fixed" as const,
      availability,
      status,
      stockQuantity: stock,
      prepTimeMinutes: Number(r.prep_time_minutes) || 60,
      primaryCategoryId: categorySlugs[0] ? catId.get(categorySlugs[0])! : null,
      isDemo: r.is_demo === "1" || r.is_demo === "true",
      images: r.image_url ? [{ url: r.image_url, alt: r.name }] : [],
      updatedAt: new Date(),
    };
    let searchText = buildSearchText(values);
    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(schema.products).where(eq(schema.products.slug, slug));
      let pid: number;
      if (existing) {
        searchText = buildSearchText({ ...existing, ...Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) });
        await tx
          .update(schema.products)
          .set({ ...values, searchText, images: values.images.length ? values.images : existing.images, ...(existing.price !== price ? { priceUpdatedAt: new Date() } : {}) })
          .where(eq(schema.products.id, existing.id));
        pid = existing.id;
        updated++;
      } else {
        const [row2] = await tx.insert(schema.products).values({ ...values, searchText, priceUpdatedAt: new Date() }).returning({ id: schema.products.id });
        pid = row2.id;
        created++;
      }
      if (categorySlugs.length) {
        await tx.delete(schema.productCategories).where(eq(schema.productCategories.productId, pid));
        await tx.insert(schema.productCategories).values(categorySlugs.map((s) => ({ productId: pid, categoryId: catId.get(s)! })));
      }
    });
  }
  revalidatePath("/admin/mahsulotlar");
  return {
    ok: errors.length === 0,
    message: `Yaratildi: ${created}, yangilandi: ${updated}.${errors.length ? ` Xatolar (${errors.length}): ${errors.slice(0, 10).join("; ")}` : ""}`,
  };
}

export async function archiveDemoProductsAction() {
  await requireOwner();
  const db = await getDb();
  await db.update(schema.products).set({ status: "archived", updatedAt: new Date() }).where(and(eq(schema.products.isDemo, true), sql`${schema.products.status} <> 'archived'`));
  revalidatePath("/admin/mahsulotlar");
}
