import Link from "next/link";
import { Price, ProductImage } from "@/components/ui/primitives";
import { localePath, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { isOrderable, type ProductCard as Card } from "@/lib/catalog-shared";
import { FavoriteButton, QuickAddButton } from "./client-widgets";
import { FloristLink } from "./florist";

export function ProductCard({
  p,
  priority,
  locale,
  index = 0,
  dark = false,
}: {
  p: Card;
  priority?: boolean;
  locale: Locale;
  index?: number;
  /** On dark (plum) sections. */
  dark?: boolean;
}) {
  const t = getDict(locale).common;
  const orderable = isOrderable(p.stock);
  const href = localePath(locale, `/gul/${p.slug}`);
  return (
    <article className="group relative flex flex-col" data-reveal style={{ "--i": index % 4 } as React.CSSProperties}>
      <div className="relative">
        <Link href={href} className="block focus-visible:outline-none" aria-label={p.name}>
          <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-cream">
            <ProductImage
              src={p.image?.url}
              alt={p.image?.alt ?? p.name}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              priority={priority}
              locale={locale}
              className={`transition duration-[1200ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.06] ${orderable ? "" : "opacity-60 grayscale-[35%]"}`}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-plum/25 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
            <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
              {!orderable ? <span className="badge bg-charcoal/85 text-ivory">{t.stock[p.stock]}</span> : null}
              {orderable && p.compareAtPrice ? <span className="badge bg-fuchsia text-white">{t.badge.sale}</span> : null}
              {orderable && p.isNew ? <span className="badge bg-ivory text-wine">{t.badge.new}</span> : null}
              {orderable && p.isPremium ? <span className="badge bg-plum text-ivory">{t.badge.premium}</span> : null}
              {p.stock === "made_to_order" ? <span className="badge bg-petal text-plum">{t.badge.madeToOrder}</span> : null}
            </div>
          </div>
        </Link>
        <FavoriteButton productId={p.id} name={p.name} className="absolute top-3 right-3" />
        {orderable && p.quickAdd ? <QuickAddButton p={{ id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.image?.url ?? null, floristId: p.florist?.id ?? null, floristName: p.florist?.name ?? null }} /> : null}
      </div>
      <div className="mt-3.5 flex flex-1 flex-col px-0.5">
        <h3 className={`font-display text-[1.3rem] leading-[1.15] sm:text-[1.4rem] ${dark ? "text-ivory" : "text-plum"}`}>
          <Link href={href} className={`transition ${dark ? "hover:text-petal" : "hover:text-wine"}`}>
            {p.name}
          </Link>
        </h3>
        {p.florist && !dark ? (
          <p className="mt-1">
            <FloristLink florist={p.florist} locale={locale} compact />
          </p>
        ) : null}
        {p.isDemo ? <p className={`mt-1 text-[11px] tracking-wide ${dark ? "text-ivory/60" : "text-muted"}`}>{t.demoProduct}</p> : null}
        <Price value={p.price} compareAt={p.compareAtPrice} from={p.hasOptions} locale={locale} dark={dark} className="mt-1.5 text-[15px]" />
      </div>
    </article>
  );
}

export function ProductGrid({ items, priorityCount = 0, locale }: { items: Card[]; priorityCount?: number; locale: Locale }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => (
        <ProductCard key={p.id} p={p} priority={i < priorityCount} locale={locale} index={i} />
      ))}
    </div>
  );
}
