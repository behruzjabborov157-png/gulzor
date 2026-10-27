"use client";

import Link from "next/link";
import { ProductGrid } from "@/components/store/product-card";
import { useFavoriteCards } from "@/components/store/widgets";
import { EmptyState } from "@/components/ui/primitives";

export function FavoritesView() {
  const { cards } = useFavoriteCards();
  if (!cards) return <div className="h-64 animate-pulse rounded-2xl bg-ivory-deep" />;
  if (!cards.length) {
    return (
      <EmptyState
        title="Sevimlilar ro‘yxati bo‘sh"
        text="Yoqqan guldastalarni yurakcha belgisi bilan saqlang — keyin bu yerdan tez topasiz."
        action={<Link href="/katalog" className="btn-primary">Katalogga o‘tish</Link>}
      />
    );
  }
  return <ProductGrid items={cards} />;
}
