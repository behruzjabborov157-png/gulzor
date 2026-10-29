import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/store/product-card";
import { Reviews } from "@/components/store/reviews";
import { CheckIcon, MapPinIcon, PhoneIcon, TelegramIcon } from "@/components/ui/icons";
import { Breadcrumbs, EmptyState } from "@/components/ui/primitives";
import { fmt, localePath } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";
import { listProducts } from "@/lib/catalog";
import { getDeliveryConfig } from "@/lib/delivery";
import { getFloristBySlug } from "@/lib/florists";
import { formatPhone, formatUZS } from "@/lib/format";
import { telegramLink } from "@/lib/settings";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sahifa?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getLocale();
  const { slug } = await params;
  const shop = await getFloristBySlug(slug, locale);
  if (!shop) return { title: getDict(locale).meta.notFound };
  return {
    title: shop.name,
    description: shop.description || getDict(locale).shop.listIntro,
    alternates: alternates(locale, `/dokon/${shop.slug}`),
  };
}

/** Public page of an approved flower shop: who they are, where they deliver, what they sell. */
export default async function ShopPage({ params, searchParams }: Props) {
  const locale = await getLocale();
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const shop = await getFloristBySlug(slug, locale);
  if (!shop) notFound();
  const dict = getDict(locale);
  const t = dict.shop;
  const lp = (p: string) => localePath(locale, p);
  const uzs = (n: number) => formatUZS(n, locale);
  const page = Math.max(1, Math.floor(Number(sp.sahifa) || 1));
  const [products, { regions }] = await Promise.all([
    listProducts({ floristId: shop.id, perPage: 24, page, sort: "popular", locale }),
    getDeliveryConfig(locale, shop.id),
  ]);
  const tg = telegramLink(shop.telegramUsername);

  return (
    <div className="container-page pt-8">
      <Breadcrumbs
        label={dict.common.breadcrumbs}
        items={[{ href: lp("/"), label: dict.common.home }, { href: lp("/dokonlar"), label: t.listTitle }, { label: shop.name }]}
      />

      <header className="grid gap-8 border-b border-line pb-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex gap-5">
          <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-petal font-display text-4xl text-wine sm:h-24 sm:w-24">
            {shop.logoUrl ? <Image src={shop.logoUrl} alt="" fill sizes="96px" className="object-cover" /> : shop.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <h1 className="text-4xl sm:text-5xl">{shop.name}</h1>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-success" title={t.verifiedHint}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10">
                <CheckIcon size={13} />
              </span>
              {t.verified}
            </p>
            {shop.description ? <p className="mt-4 max-w-2xl leading-relaxed text-charcoal/85">{shop.description}</p> : null}
          </div>
        </div>
        <ul className="space-y-2.5 text-sm">
          {shop.city ? (
            <li className="flex items-center gap-2">
              <MapPinIcon size={16} className="text-wine" /> {fmt(t.city, { city: shop.city })}
            </li>
          ) : null}
          {shop.address ? <li className="pl-6 text-muted">{fmt(t.address, { address: shop.address })}</li> : null}
          {shop.legalName && !shop.isPlatform ? <li className="pl-6 text-muted">{fmt(t.seller, { name: shop.legalName })}</li> : null}
          {shop.phone ? (
            <li>
              <a href={`tel:${shop.phone}`} className="inline-flex items-center gap-2 hover:text-wine">
                <PhoneIcon size={16} className="text-wine" /> {formatPhone(shop.phone)}
              </a>
            </li>
          ) : null}
          {tg ? (
            <li>
              <a href={tg} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-wine">
                <TelegramIcon size={16} className="text-wine" /> @{shop.telegramUsername.replace(/^@/, "")}
              </a>
            </li>
          ) : null}
        </ul>
      </header>

      <section className="mt-10" aria-labelledby="shop-delivery">
        <h2 id="shop-delivery" className="text-2xl">
          {t.delivery}
        </h2>
        {regions.length === 0 ? (
          <p className="mt-3 text-muted">{t.deliveryNone}</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {regions.flatMap((r) =>
              r.zones.map((z) => (
                <li key={z.id} className="card p-4 text-sm">
                  <p className="font-semibold text-plum">
                    {r.name} — {z.name}
                  </p>
                  {z.description ? <p className="mt-0.5 text-muted">{z.description}</p> : null}
                  <p className="mt-1.5 font-semibold text-wine">
                    {uzs(z.fee)}
                    {z.freeFrom ? <span className="ml-2 font-normal text-muted">· {fmt(t.freeFrom, { amount: uzs(z.freeFrom) })}</span> : null}
                  </p>
                </li>
              )),
            )}
          </ul>
        )}
      </section>

      <Reviews by={{ floristId: shop.id }} locale={locale} className="mt-14" />

      <section className="mt-14" aria-labelledby="shop-products">
        <h2 id="shop-products" className="mb-6 text-3xl">
          {t.shopProducts}
        </h2>
        {products.items.length === 0 ? (
          <EmptyState title={t.noProducts} />
        ) : (
          <>
            <ProductGrid items={products.items} locale={locale} />
            {products.pages > 1 ? (
              <nav className="mt-10 flex flex-wrap justify-center gap-2" aria-label={dict.catalog.pages}>
                {Array.from({ length: products.pages }, (_, i) => i + 1).map((n) => (
                  <Link
                    key={n}
                    href={lp(`/dokon/${shop.slug}${n > 1 ? `?sahifa=${n}` : ""}`)}
                    aria-current={n === products.page ? "page" : undefined}
                    className={`chip ${n === products.page ? "chip-active" : ""}`}
                  >
                    {n}
                  </Link>
                ))}
              </nav>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
