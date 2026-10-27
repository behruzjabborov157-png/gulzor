import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogView, type SearchParams } from "@/components/store/catalog-view";
import { CatalogSkeleton } from "@/components/ui/skeletons";
import { fmt } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";
import { getCategoryBySlug } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDict(locale).meta;
  const cat = await getCategoryBySlug((await params).slug, locale);
  if (!cat) return { title: t.notFound };
  return {
    title: cat.seoTitle || fmt(t.categoryTitle, { name: cat.name }),
    description: cat.seoDescription || fmt(t.categoryDescription, { description: cat.description }),
    alternates: alternates(locale, `/katalog/${cat.slug}`),
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const locale = await getLocale();
  const cat = await getCategoryBySlug(slug, locale);
  // Checked before the Suspense boundary so unknown categories get a real 404 status.
  if (!cat) notFound();
  const sp = await searchParams;
  return (
    <Suspense key={JSON.stringify(sp)} fallback={<CatalogSkeleton />}>
      <CatalogView base={cat} searchParams={sp} basePath={`/katalog/${cat.slug}`} locale={locale} />
    </Suspense>
  );
}
