import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { fromPrice, type PricingProduct } from "@/lib/pricing";
import { tashkentNow } from "@/lib/time";
import { isOrderable, type ProductCard, type StockState } from "@/lib/catalog-shared";

export { isOrderable, STOCK_LABEL, type ProductCard, type StockState } from "@/lib/catalog-shared";

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

export function toPricing(prod: Product, variants: Variant[]): PricingProduct {
  return {
    pricingMode: prod.pricingMode,
    price: prod.price,
    stemPrice: prod.stemPrice,
    minStems: prod.minStems,
    maxStems: prod.maxStems,
    stemStep: prod.stemStep,
    variants: variants.map((v) => ({ id: v.id, name: v.name, price: v.price, stemCount: v.stemCount, isActive: v.isActive })),
  };
}

function compareFor(prod: Product, variants: Variant[]): number | null {
  if (prod.pricingMode === "variants") {
    const active = variants.filter((v) => v.isActive).sort((a, b) => a.price - b.price)[0];
    return active?.compareAtPrice ?? null;
  }
  return prod.compareAtPrice;
}

export function toCard(prod: Product, variants: Variant[]): ProductCard {
  const price = fromPrice(toPricing(prod, variants));
  const cmp = compareFor(prod, variants);
  return {
    id: prod.id,
    slug: prod.slug,
    name: prod.name,
    shortDescription: prod.shortDescription,
    image: prod.images[0] ? { url: prod.images[0].url, alt: prod.images[0].alt || prod.name } : null,
    price,
    compareAtPrice: cmp && cmp > price ? cmp : null,
    hasOptions: prod.pricingMode !== "fixed",
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

/** Removes the many apostrophe variants used in Uzbek Latin so "o'z" matches "o‘z". */
export function normalizeSearch(s: string) {
  return s.toLowerCase().replace(/[ʻʼ‘’'`]/g, "").replace(/\s+/g, " ").trim();
}
const APOS = "ʻʼ‘’'`";

export type CatalogQuery = {
  q?: string;
  categories?: string[]; // all must match (e.g. type + occasion)
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: "popular" | "price_asc" | "price_desc" | "new";
  page?: number;
  perPage?: number;
  includeAddons?: boolean;
  excludeIds?: number[];
};

export const SORTS: { value: NonNullable<CatalogQuery["sort"]>; label: string }[] = [
  { value: "popular", label: "Ommabop" },
  { value: "price_asc", label: "Arzonroq" },
  { value: "price_desc", label: "Qimmatroq" },
  { value: "new", label: "Yangi" },
];

export async function listProducts(query: CatalogQuery) {
  const db = await getDb();
  const perPage = Math.min(Math.max(query.perPage ?? 12, 1), 48);
  const page = Math.max(query.page ?? 1, 1);
  const where: SQL[] = [eq(p.status, "active")];

  if (!query.includeAddons) where.push(eq(p.isAddon, false));
  for (const slug of query.categories ?? []) where.push(inCategory(slug));
  if (query.q) {
    const term = `%${normalizeSearch(query.q)}%`;
    where.push(sql`(
      translate(lower(${p.name}), ${APOS}, '') LIKE ${term}
      OR translate(lower(${p.shortDescription}), ${APOS}, '') LIKE ${term}
      OR translate(lower(${p.flowerVarieties}::text), ${APOS}, '') LIKE ${term})`);
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

  return { items: await withVariants(rows), total: count, page, perPage, pages: Math.max(1, Math.ceil(count / perPage)) };
}

export async function withVariants(rows: Product[]): Promise<ProductCard[]> {
  if (!rows.length) return [];
  const db = await getDb();
  const vs = await db.select().from(pv).where(inArray(pv.productId, rows.map((r) => r.id)));
  return rows.map((r) => toCard(r, vs.filter((v) => v.productId === r.id)));
}

export async function getProductsByIds(ids: number[]): Promise<ProductCard[]> {
  if (!ids.length) return [];
  const db = await getDb();
  const rows = await db.select().from(p).where(and(inArray(p.id, ids), eq(p.status, "active")));
  const cards = await withVariants(rows);
  return ids.map((id) => cards.find((x) => x.id === id)).filter((x): x is ProductCard => !!x);
}

export async function getProductBySlug(slug: string) {
  const db = await getDb();
  const [prod] = await db.select().from(p).where(and(eq(p.slug, slug), eq(p.status, "active")));
  if (!prod) return null;
  const variants = await db.select().from(pv).where(eq(pv.productId, prod.id)).orderBy(asc(pv.sortOrder), asc(pv.price));
  const cats = await db
    .select({ id: c.id, slug: c.slug, name: c.name, kind: c.kind })
    .from(pc)
    .innerJoin(c, eq(c.id, pc.categoryId))
    .where(and(eq(pc.productId, prod.id), eq(c.isActive, true)));
  return { product: prod, variants, categories: cats, stock: stockState(prod, variants) };
}

/** Add-ons that can be attached to bouquets (cards, sweets, toys, vases). */
export async function getAddons() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(p)
    .where(and(eq(p.status, "active"), eq(p.isAddon, true)))
    .orderBy(asc(p.price));
  return rows
    .filter((r) => isOrderable(stockState(r, [])))
    .map((r) => ({ productId: r.id, name: r.name, price: r.price, image: r.images[0]?.url ?? null, slug: r.slug }));
}

/** Products that share categories with the given product, available first. */
export async function getRelated(productId: number, categoryIds: number[], limit = 4) {
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
  const cards = await withVariants(rows);
  return cards.sort((a, b) => Number(isOrderable(b.stock)) - Number(isOrderable(a.stock))).slice(0, limit);
}

export async function getCategories(kind?: Category["kind"]) {
  const db = await getDb();
  const where = kind ? and(eq(c.isActive, true), eq(c.kind, kind)) : eq(c.isActive, true);
  return db.select().from(c).where(where).orderBy(asc(c.sortOrder), asc(c.name));
}

export async function getCategoryBySlug(slug: string) {
  const db = await getDb();
  const [row] = await db.select().from(c).where(and(eq(c.slug, slug), eq(c.isActive, true)));
  return row ?? null;
}

/** Budget bands used on the homepage and in filters. */
export const BUDGETS = [
  { label: "250 000 so‘mgacha", min: undefined, max: 250_000 },
  { label: "250 000 – 500 000 so‘m", min: 250_000, max: 500_000 },
  { label: "500 000 – 1 000 000 so‘m", min: 500_000, max: 1_000_000 },
  { label: "1 000 000 so‘mdan yuqori", min: 1_000_000, max: undefined },
] as const;
