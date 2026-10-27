import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { siteUrl } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const db = await getDb();
  const [products, categories] = await Promise.all([
    db
      .select({ slug: schema.products.slug, updatedAt: schema.products.updatedAt })
      .from(schema.products)
      .where(and(eq(schema.products.status, "active"))),
    db.select({ slug: schema.categories.slug }).from(schema.categories).where(eq(schema.categories.isActive, true)),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/katalog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/yetkazib-berish`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/maxsus-guldasta`, changeFrequency: "monthly", priority: 0.5 },
    ...categories.map((c) => ({ url: `${base}/katalog/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/gul/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
