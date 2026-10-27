import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogView, type SearchParams } from "@/components/store/catalog-view";
import { CatalogSkeleton } from "@/components/ui/skeletons";

export const metadata: Metadata = {
  title: "Onlayn gul buyurtma qilish — guldastalar narxi",
  description: "Barcha gullar va guldastalar: atirgullar, lolalar, xrizantemalar, qutidagi va savatdagi gullar. Narx, gul turi va munosabat bo‘yicha filtrlang.",
  alternates: { canonical: "/katalog" },
};

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  // Keyed by the filters so the skeleton shows while a new filter combination loads.
  return (
    <Suspense key={JSON.stringify(sp)} fallback={<CatalogSkeleton />}>
      <CatalogView base={null} searchParams={sp} basePath="/katalog" />
    </Suspense>
  );
}
