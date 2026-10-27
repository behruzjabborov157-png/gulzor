import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogView, type SearchParams } from "@/components/store/catalog-view";
import { CatalogSkeleton } from "@/components/ui/skeletons";
import { getCategoryBySlug } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = await getCategoryBySlug((await params).slug);
  if (!cat) return { title: "Topilmadi" };
  return {
    title: cat.seoTitle || `${cat.name} — Toshkentda gul yetkazib berish`,
    description: cat.seoDescription || `${cat.description} Narxlar so‘mda, onlayn buyurtma va yetkazib berish.`,
    alternates: { canonical: `/katalog/${cat.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  // Checked before the Suspense boundary so unknown categories get a real 404 status.
  if (!cat) notFound();
  const sp = await searchParams;
  return (
    <Suspense key={JSON.stringify(sp)} fallback={<CatalogSkeleton />}>
      <CatalogView base={cat} searchParams={sp} basePath={`/katalog/${cat.slug}`} />
    </Suspense>
  );
}
