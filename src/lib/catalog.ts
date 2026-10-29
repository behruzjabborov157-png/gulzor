import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DEFAULT_LOCALE, pick, type Locale } from "@/i18n/config";
import { isOrderable, type ProductCard, type StockState } from "@/lib/catalog-shared";
import { fromPrice, type PricingProduct } from "@/lib/pricing";
import { normalizeSearch } from "@/lib/search";
import { tashkentNow } from "@/lib/time";

export { isOrderable, type ProductCard, type StockState } from "@/lib/catalog-shared";

const { products: p, productVariants: pv, categories: c, productCategories: pc } = schema;

export type Product = typeof schema.products.$inferSelect;
export type Variant = typeof schema.productVariants.$inferSelect;
export type Category = typeof schema.categories.$inferSelect;

/** Product-level availability, taking stock, variants and season into account. */
export function stockState(prod: Product, variants: Variant[], month = tashkentNow().month): StockState {
  if (prod.seasonalMonths.length > 0 && !prod.seasonalMonths.includes(month)) return "out_of_season";
  if (prod.availability === "out_of_stock") return "out_of_stock";
  if (prod.stockQuantity != null && prod.stockQuantity <= 0) return "out_of_stock";
  if (prod.pricingMode === "variants") {
    const active = variants.filter((v) => v.isActive);
    if (active.length === 0) return "out_of_stock";
    if (active.every((v) => v.stockQuantity != null && v.stockQuantity <= 0)) return "out_of_stock";
  }
  return prod.availability === "made_to_order" ? "made_to_order" : "available";
}

export function toPricing(prod: Product, variants: Variant[], locale: Locale = DEFAULT_LOCALE): PricingProduct {
  return {
    pricingMode: prod.pricingMode,
    price: prod.price,
    stemPrice: prod.stemPrice,
    minStems: prod.minStems,
    maxStems: prod.maxStems,
    stemStep: prod.stemStep,
    variants: variants.map((v) => ({ id: v.id, name: pick(locale, v.name, v.nameRu), price: v.price, stemCount: v.stemCount, isActive: v.isActive })),
  };
}

function compareFor(prod: Product, variants: Variant[]): number | null {
  if (prod.pricingMode === "variants") {
    const active = variants.filter((v) => v.isActive).sort((a, b) => a.price - b.price)[0];
    return active?.compareAtPrice ?? null;
  }
  return prod.compareAtPrice;
}

export function toCard(prod: Product, variants: Variant[], locale: Locale = DEFAULT_LOCALE): ProductCard {
  const price = fromPrice(toPricing(prod, variants));
  const cmp = compareFor(prod, variants);
  const name = pick(locale, prod.name, prod.nameRu);
  return {
    id: prod.id,
    slug: prod.slug,
    name,
    shortDescription: pick(locale, prod.shortDescription, prod.shortDescriptionRu),
    // Uploaded alt texts are Uzbek; in Russian the localized product name describes the photo better.
    image: prod.images[0] ? { url: prod.images[0].url, alt: locale === DEFAULT_LOCALE ? prod.images[0].alt || name : name } : null,
    price,
    compareAtPrice: cmp && cmp > price ? cmp : null,
    hasOptions: prod.pricingMode !== "fixed",
    // Can go straight into the cart from a card: fixed price and nothing to choose.
    quickAdd: prod.pricingMode === "fixed" && prod.colorOptions.length === 0,
    stock: stockState(prod, variants),
    isNew: prod.isNew,
    isPremium: prod.isPremium,
    isDemo: prod.isDemo,
    isAddon: prod.isAddon,
  };
}

/** SQL expression for the lowest purchasable price of a product. */
const effectivePrice = sql<number>`(CASE ${p.pricingMode}
  WHEN 'variants' THEN (SELECT MIN(${pv.price}) FROM ${pv} WHERE ${pv.productId} = ${p.id} AND ${pv.isActive})
  WHEN 'per_stem' THEN ${p.stemPrice} * COALESCE(${p.minStems}, 1)
  ELSE ${p.price} END)`;

function inCategory(slug: string): SQL {
  return sql`EXISTS (SELECT 1 FROM ${pc} JOIN ${c} ON ${c.id} = ${pc.categoryId}
    WHERE ${pc.productId} = ${p.id} AND ${c.slug} = ${slug} AND ${c.isActive})`;
}

export type CatalogQuery = {
  q?: string;
  categories?: string[]; // all must match (e.g. type + occasion)
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: (typeof SORTS)[number];
  page?: number;
  perPage?: number;
  includeAddons?: boolean;
  excludeIds?: number[];
  locale?: Locale;
};

/** Sort options; labels come from the dictionary (t.catalog.sorts). */
export const SORTS = ["popular", "price_asc", "price_desc", "new"] as const;

export async function listProducts(query: CatalogQuery) {
  const db = await getDb();
  const perPage = Math.min(Math.max(query.perPage ?? 12, 1), 48);
  const page = Math.max(query.page ?? 1, 1);
  const where: SQL[] = [eq(p.status, "active")];

  if (!query.includeAddons) where.push(eq(p.isAddon, false));
  for (const slug of query.categories ?? []) where.push(inCategory(slug));
  if (query.q) {
    // search_text holds both languages, normalised in JS (lib/search.ts) so Cyrillic works on any DB locale.
    where.push(sql`${p.searchText} LIKE ${`%${normalizeSearch(query.q)}%`}`);
  }
  if (query.minPrice != null) where.push(sql`${effectivePrice} >= ${query.minPrice}`);
  if (query.maxPrice != null) where.push(sql`${effectivePrice} <= ${query.maxPrice}`);
  if (query.inStock) {
    const month = tashkentNow().month;
    where.push(sql`${p.availability} <> 'out_of_stock'`);
    where.push(sql`(${p.stockQuantity} IS NULL OR ${p.stockQuantity} > 0)`);
    where.push(sql`(jsonb_array_length(${p.seasonalMonths}) = 0 OR ${p.seasonalMonths} @> ${JSON.stringify([month])}::jsonb)`);
    where.push(sql`(${p.pricingMode} <> 'variants' OR EXISTS (SELECT 1 FROM ${pv} WHERE ${pv.productId} = ${p.id}
      AND ${pv.isActive} AND (${pv.stockQuantity} IS NULL OR ${pv.stockQuantity} > 0)))`);
  }
  if (query.excludeIds?.length) where.push(sql`${p.id} NOT IN (${sql.join(query.excludeIds.map((id) => sql`${id}`), sql`, `)})`);

  const order =
    query.sort === "price_asc"
      ? [sql`${effectivePrice} ASC`, asc(p.id)]
      : query.sort === "price_desc"
        ? [sql`${effectivePrice} DESC`, asc(p.id)]
        : query.sort === "new"
          ? [sql`${p.isNew} DESC`, sql`${p.createdAt} DESC`, asc(p.id)]
          : [sql`${p.salesCount} DESC`, sql`${p.isFeatured} DESC`, asc(p.id)];

  const cond = and(...where);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(p).where(cond);
  const rows = await db
    .select()
    .from(p)
    .where(cond)
    .orderBy(...order)
    .limit(perPage)
    .offset((page - 1) * perPage);

  return { items: await withVariants(rows, query.locale), total: count, page, perPage, pages: Math.max(1, Math.ceil(count / perPage)) };
}

export async function withVariants(rows: Product[], locale: Locale = DEFAULT_LOCALE): Promise<ProductCard[]> {
  if (!rows.length) return [];
  const db = await getDb();
  const vs = await db.select().from(pv).where(inArray(pv.productId, rows.map((r) => r.id)));
  return rows.map((r) => toCard(r, vs.filter((v) => v.productId === r.id), locale));
}

export async function getProductsByIds(ids: number[], locale: Locale = DEFAULT_LOCALE): Promise<ProductCard[]> {
  if (!ids.length) return [];
  const db = await getDb();
  const rows = await db.select().from(p).where(and(inArray(p.id, ids), eq(p.status, "active")));
  const cards = await withVariants(rows, locale);
  return ids.map((id) => cards.find((x) => x.id === id)).filter((x): x is ProductCard => !!x);
}

export async function getProductBySlug(slug: string, locale: Locale = DEFAULT_LOCALE) {
  const db = await getDb();
  const [prod] = await db.select().from(p).where(and(eq(p.slug, slug), eq(p.status, "active")));
  if (!prod) return null;
  const variants = await db.select().from(pv).where(eq(pv.productId, prod.id)).orderBy(asc(pv.sortOrder), asc(pv.price));
  const cats = await db
    .select({ id: c.id, slug: c.slug, name: c.name, nameRu: c.nameRu, kind: c.kind })
    .from(pc)
    .innerJoin(c, eq(c.id, pc.categoryId))
    .where(and(eq(pc.productId, prod.id), eq(c.isActive, true)));
  return {
    product: prod,
    variants,
    categories: cats.map((x) => ({ id: x.id, slug: x.slug, kind: x.kind, name: pick(locale, x.name, x.nameRu) })),
    stock: stockState(prod, variants),
  };
}

/** Add-ons that can be attached to bouquets (cards, sweets, toys, vases). */
export async function getAddons(locale: Locale = DEFAULT_LOCALE) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(p)
    .where(and(eq(p.status, "active"), eq(p.isAddon, true)))
    .orderBy(asc(p.price));
  return rows
    .filter((r) => isOrderable(stockState(r, [])))
    .map((r) => ({ productId: r.id, name: pick(locale, r.name, r.nameRu), price: r.price, image: r.images[0]?.url ?? null, slug: r.slug }));
}

/** Products that share categories with the given product, available first. */
export async function getRelated(productId: number, categoryIds: number[], limit = 4, locale: Locale = DEFAULT_LOCALE) {
  const db = await getDb();
  if (!categoryIds.length) return [];
  const rows = await db
    .select()
    .from(p)
    .where(
      and(
        eq(p.status, "active"),
        eq(p.isAddon, false),
        sql`${p.id} <> ${productId}`,
        sql`EXISTS (SELECT 1 FROM ${pc} WHERE ${pc.productId} = ${p.id} AND ${pc.categoryId} IN (${sql.join(
          categoryIds.map((id) => sql`${id}`),
          sql`, `,
        )}))`,
      ),
    )
    .orderBy(sql`${p.salesCount} DESC`, asc(p.id))
    .limit(limit * 3);
  const cards = await withVariants(rows, locale);
  return cards.sort((a, b) => Number(isOrderable(b.stock)) - Number(isOrderable(a.stock))).slice(0, limit);
}

/** Category with name/description/SEO fields already in the requested language. */
export function localizeCategory(row: Category, locale: Locale): Category {
  if (locale === DEFAULT_LOCALE) return row;
  return {
    ...row,
    name: pick(locale, row.name, row.nameRu),
    description: pick(locale, row.description, row.descriptionRu),
    seoTitle: row.seoTitleRu || null,
    seoDescription: row.seoDescriptionRu || null,
  };
}

export async function getCategories(kind?: Category["kind"], locale: Locale = DEFAULT_LOCALE) {
  const db = await getDb();
  const where = kind ? and(eq(c.isActive, true), eq(c.kind, kind)) : eq(c.isActive, true);
  const rows = await db.select().from(c).where(where).orderBy(asc(c.sortOrder), asc(c.name));
  return rows.map((r) => localizeCategory(r, locale));
}

export async function getCategoryBySlug(slug: string, locale: Locale = DEFAULT_LOCALE) {
  const db = await getDb();
  const [row] = await db.select().from(c).where(and(eq(c.slug, slug), eq(c.isActive, true)));
  return row ? localizeCategory(row, locale) : null;
}

/** Budget bands used on the homepage (labels in t.home.budgets, same order). */
export const BUDGETS = [
  { min: undefined, max: 250_000 },
  { min: 250_000, max: 500_000 },
  { min: 500_000, max: 1_000_000 },
  { min: 1_000_000, max: undefined },
] as const;
