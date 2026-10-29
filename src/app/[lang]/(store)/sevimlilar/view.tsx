"use client";

import Link from "next/link";
import { ProductGrid } from "@/components/store/product-card";
import { useFavoriteCards } from "@/components/store/widgets";
import { EmptyState } from "@/components/ui/primitives";
import { useT } from "@/i18n/client";

export function FavoritesView() {
  const { cards } = useFavoriteCards();
  const { locale, t, href } = useT();
  if (!cards) return <div className="h-64 animate-pulse rounded-2xl bg-cream" />;
  if (!cards.length) {
    return (
      <EmptyState
        title={t.account.favoritesEmpty}
        text={t.account.favoritesEmptyText}
        action={
          <Link href={href("/katalog")} className="btn-primary">
            {t.account.toCatalog}
          </Link>
        }
      />
    );
  }
  return <ProductGrid items={cards} locale={locale} />;
}
