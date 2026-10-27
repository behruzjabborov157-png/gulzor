import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { LOCALES, localePath } from "@/i18n/config";
import { siteUrl } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Entry = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const db = await getDb();
  const [products, categories] = await Promise.all([
    db.select({ slug: schema.products.slug, updatedAt: schema.products.updatedAt }).from(schema.products).where(eq(schema.products.status, "active")),
    db.select({ slug: schema.categories.slug }).from(schema.categories).where(eq(schema.categories.isActive, true)),
  ]);

  // One entry per language, each listing its translations (hreflang).
  const both = (path: string, extra: Omit<Entry, "url"> = {}): Entry[] =>
    LOCALES.map((locale) => ({
      url: base + localePath(locale, path),
      ...extra,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, base + localePath(l, path)])) },
    }));

  return [
    ...both("/", { changeFrequency: "daily", priority: 1 }),
    ...both("/katalog", { changeFrequency: "daily", priority: 0.9 }),
    ...both("/yetkazib-berish", { changeFrequency: "monthly", priority: 0.6 }),
    ...both("/maxsus-guldasta", { changeFrequency: "monthly", priority: 0.5 }),
    ...categories.flatMap((c) => both(`/katalog/${c.slug}`, { changeFrequency: "weekly", priority: 0.8 })),
    ...products.flatMap((p) => both(`/gul/${p.slug}`, { lastModified: p.updatedAt, changeFrequency: "weekly", priority: 0.7 })),
  ];
}
