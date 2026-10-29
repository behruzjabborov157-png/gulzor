import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { platformFloristId } from "@/lib/florists";
import { slugify } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import { buildSearchText } from "@/lib/search";
import { saveImage, UploadError } from "@/lib/storage";

/**
 * Who is saving: Gulzor staff (any product; new ones go to the platform's own shop) or a florist
 * (only its own products; curation flags — demo, featured, premium — stay under Gulzor's control).
 */
export type ProductScope = { kind: "admin" } | { kind: "florist"; floristId: number };

export const formInt = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[\s ]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : NaN;
};
export const formLines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** May this scope edit this product? */
export async function canEditProduct(scope: ProductScope, productId: number) {
  if (scope.kind === "admin") return true;
  const db = await getDb();
  const [p] = await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.id, productId), eq(schema.products.floristId, scope.floristId)));
  return !!p;
}

/** Validates and saves the product form. Returns the form state and, on success, the product id. */
export async function saveProductForm(scope: ProductScope, productId: number | null, form: FormData): Promise<{ state: FormState; id?: number }> {
  const db = await getDb();
  if (productId && !(await canEditProduct(scope, productId))) return { state: { ok: false, message: "Mahsulot topilmadi" } };
  const errors: Record<string, string> = {};
  const int = formInt;
  const lines = formLines;

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
  let before: typeof schema.products.$inferSelect | undefined;
  if (productId) [before] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  const existing = before?.images ?? [];
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

  if (Object.keys(errors).length) return { state: { ok: false, errors, message: "Xatolarni to‘g‘rilang" } };

  const [dup] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.slug, slug));
  if (dup && dup.id !== productId) return { state: { ok: false, errors: { slug: "Bu slug band" } } };

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
  const isFlorist = scope.kind === "florist";
  // Curation flags are Gulzor's decision: a florist keeps whatever Gulzor set (false on new products).
  const curated = (field: "isDemo" | "isFeatured" | "isPremium") => (isFlorist ? (before?.[field] ?? false) : form.get(field) === "on");
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
    price: pricingMode === "fixed" ? price : price || 0,
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
    isDemo: curated("isDemo"),
    isFeatured: curated("isFeatured"),
    isNew: form.get("isNew") === "on",
    isPremium: curated("isPremium"),
    seoTitle: String(form.get("seoTitle") ?? "").trim() || null,
    seoDescription: String(form.get("seoDescription") ?? "").trim() || null,
    updatedAt: new Date(),
  };

  // Looked up before the transaction: a query on another connection inside it would deadlock a single-connection database.
  const ownerFloristId = scope.kind === "florist" ? scope.floristId : await platformFloristId();
  const id = await db.transaction(async (tx) => {
    let pid = productId;
    if (pid) {
      const beforeVariants = await tx.select().from(schema.productVariants).where(eq(schema.productVariants.productId, pid));
      const priceChanged =
        before!.price !== values.price ||
        before!.stemPrice !== values.stemPrice ||
        before!.compareAtPrice !== values.compareAtPrice ||
        JSON.stringify(beforeVariants.map((v) => [v.id, v.price])) !== JSON.stringify(variants.filter((v) => v.id).map((v) => [v.id, v.price])) ||
        variants.some((v) => !v.id);
      await tx
        .update(schema.products)
        .set({ ...values, ...(priceChanged ? { priceUpdatedAt: new Date() } : {}) })
        .where(eq(schema.products.id, pid));
    } else {
      const [row] = await tx.insert(schema.products).values({ ...values, floristId: ownerFloristId, priceUpdatedAt: new Date() }).returning({ id: schema.products.id });
      pid = row.id;
    }
    // Variants: update existing (only this product's), insert new, remove deleted.
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

  return { state: { ok: true, message: "Saqlandi" }, id };
}
