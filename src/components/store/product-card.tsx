import Link from "next/link";
import { Price, ProductImage } from "@/components/ui/primitives";
import { localePath, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { isOrderable, type ProductCard as Card } from "@/lib/catalog-shared";
import { FavoriteButton } from "./client-widgets";

export function ProductCard({ p, priority, locale }: { p: Card; priority?: boolean; locale: Locale }) {
  const t = getDict(locale).common;
  const orderable = isOrderable(p.stock);
  const href = localePath(locale, `/gul/${p.slug}`);
  return (
    <article className="group relative flex flex-col">
      <Link href={href} className="block focus-visible:outline-none" aria-label={p.name}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-ivory-deep">
          <ProductImage
            src={p.image?.url}
            alt={p.image?.alt ?? p.name}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
            locale={locale}
            className={`transition duration-700 ease-out group-hover:scale-[1.04] ${orderable ? "" : "opacity-60 grayscale-[35%]"}`}
          />
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {!orderable ? <span className="badge bg-charcoal/85 text-ivory">{t.stock[p.stock]}</span> : null}
            {orderable && p.isNew ? <span className="badge bg-ivory text-forest">{t.badge.new}</span> : null}
            {orderable && p.isPremium ? <span className="badge bg-forest text-ivory">{t.badge.premium}</span> : null}
            {p.stock === "made_to_order" ? <span className="badge bg-blush text-charcoal">{t.badge.madeToOrder}</span> : null}
          </div>
        </div>
      </Link>
      <FavoriteButton productId={p.id} name={p.name} className="absolute top-3 right-3" />
      <div className="mt-3 flex flex-1 flex-col px-0.5">
        <h3 className="font-sans text-[15px] leading-snug font-medium text-charcoal">
          <Link href={href} className="hover:text-forest">
            {p.name}
          </Link>
        </h3>
        {p.isDemo ? <p className="mt-0.5 text-[11px] text-muted">{t.demoProduct}</p> : null}
        <Price value={p.price} compareAt={p.compareAtPrice} from={p.hasOptions} locale={locale} className="mt-1.5 text-[15px]" />
      </div>
    </article>
  );
}

export function ProductGrid({ items, priorityCount = 0, locale }: { items: Card[]; priorityCount?: number; locale: Locale }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => (
        <ProductCard key={p.id} p={p} priority={i < priorityCount} locale={locale} />
      ))}
    </div>
  );
}
