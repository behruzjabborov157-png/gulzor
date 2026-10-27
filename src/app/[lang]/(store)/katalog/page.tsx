import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogView, type SearchParams } from "@/components/store/catalog-view";
import { CatalogSkeleton } from "@/components/ui/skeletons";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDict(locale).meta;
  return { title: t.catalogTitle, description: t.catalogDescription, alternates: alternates(locale, "/katalog") };
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [sp, locale] = await Promise.all([searchParams, getLocale()]);
  // Keyed by the filters so the skeleton shows while a new filter combination loads.
  return (
    <Suspense key={JSON.stringify(sp)} fallback={<CatalogSkeleton />}>
      <CatalogView base={null} searchParams={sp} basePath="/katalog" locale={locale} />
    </Suspense>
  );
}
