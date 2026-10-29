import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FavoriteButton, TrackRecent } from "@/components/store/client-widgets";
import { Gallery } from "@/components/store/gallery";
import { ProductGrid } from "@/components/store/product-card";
import { FloristLink } from "@/components/store/florist";
import { ProductConfigurator } from "@/components/store/product-configurator";
import { RecentlyViewed } from "@/components/store/widgets";
import { ClockIcon, InfoIcon, TruckIcon } from "@/components/ui/icons";
import { Breadcrumbs, Price } from "@/components/ui/primitives";
import { CardGridSkeleton } from "@/components/ui/skeletons";
import { fmt, localePath, pick, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";
import { getAddons, getProductBySlug, getRelated, isOrderable, toPricing } from "@/lib/catalog";
import { getFloristById } from "@/lib/florists";
import { formatDateTime } from "@/lib/format";
import { fromPrice } from "@/lib/pricing";
import { siteUrl } from "@/lib/settings";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDict(locale).meta;
  const data = await getProductBySlug((await params).slug, locale);
  if (!data) return { title: t.productNotFound };
  const p = data.product;
  const name = pick(locale, p.name, p.nameRu);
  const seoTitle = locale === "ru" ? p.seoTitleRu : p.seoTitle;
  const seoDescription = locale === "ru" ? p.seoDescriptionRu : p.seoDescription;
  const text = `${pick(locale, p.shortDescription, p.shortDescriptionRu)} ${pick(locale, p.description, p.descriptionRu)}`;
  return {
    title: seoTitle || fmt(t.productTitle, { name }),
    description: seoDescription || text.slice(0, 160),
    alternates: alternates(locale, `/gul/${p.slug}`),
    openGraph: { title: name, locale: t.ogLocale, images: p.images[0] ? [{ url: p.images[0].url }] : undefined },
  };
}

function prepLabel(locale: Locale, min: number) {
  const t = getDict(locale).product;
  if (min >= 1440) return fmt(t.prepDays, { n: Math.round(min / 1440) });
  if (min >= 60) return fmt(t.prepHours, { n: Math.round(min / 60) });
  return fmt(t.prepMinutes, { n: min });
}

/** Streams in after the main product content. Shows alternatives when the product cannot be ordered. */
async function Related({ productId, categoryIds, orderable, locale }: { productId: number; categoryIds: number[]; orderable: boolean; locale: Locale }) {
  const related = await getRelated(productId, categoryIds, 4, locale);
  if (!related.length) return null;
  const t = getDict(locale).product;
  return (
    <section className="container-page mt-24" aria-labelledby="rel-h">
      <h2 id="rel-h" className="mb-8 text-3xl sm:text-4xl">
        {orderable ? t.relatedLike : t.relatedSimilar}
      </h2>
      <ProductGrid items={related} locale={locale} />
    </section>
  );
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const locale = await getLocale();
  const data = await getProductBySlug(slug, locale);
  if (!data) notFound();
  const dict = getDict(locale);
  const t = dict.product;
  const lp = (path: string) => localePath(locale, path);
  const { product: p, variants, categories, stock } = data;
  const orderable = isOrderable(stock);
  const pricing = toPricing(p, variants, locale);
  const [addons, florist] = await Promise.all([p.isAddon ? [] : getAddons(locale, p.floristId), getFloristById(p.floristId, locale)]);
  if (!florist) notFound();
  const primary = categories.find((c) => c.id === p.primaryCategoryId) ?? categories[0];
  const price = fromPrice(pricing);

  const name = pick(locale, p.name, p.nameRu);
  const description = pick(locale, p.description, p.descriptionRu);
  const care = pick(locale, p.careInstructions, p.careInstructionsRu);
  const sizeLabel = p.sizeLabel ? pick(locale, p.sizeLabel, p.sizeLabelRu) : null;
  const varieties = locale === "ru" && p.flowerVarietiesRu.length ? p.flowerVarietiesRu : p.flowerVarieties;
  const colors = p.colorOptions.map((value, i) => ({ value, label: (locale === "ru" && p.colorOptionsRu[i]) || value }));

  // Structured data only for real (non-demo) products, so search engines never index sample prices.
  const jsonLd = p.isDemo
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "Product",
        name,
        description,
        image: p.images.map((i) => siteUrl() + i.url),
        sku: String(p.id),
        offers: {
          "@type": "Offer",
          priceCurrency: "UZS",
          price,
          availability: orderable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: siteUrl() + lp(`/gul/${p.slug}`),
        },
      };

  return (
    <>
      <TrackRecent id={p.id} />
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /> : null}
      <div className="container-page pt-8">
        <Breadcrumbs
          label={dict.common.breadcrumbs}
          items={[
            { href: lp("/"), label: dict.common.home },
            { href: lp("/katalog"), label: dict.common.catalog },
            ...(primary ? [{ href: lp(`/katalog/${primary.slug}`), label: primary.name }] : []),
            { label: name },
          ]}
        />
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="lg:sticky lg:top-36 lg:self-start">
            <Gallery images={p.images.map((i) => ({ url: i.url, alt: locale === "uz" ? i.alt : name }))} name={name} />
            {p.isDemo ? (
              <p className="mt-3 flex items-start gap-2 text-xs text-muted">
                <InfoIcon size={16} className="mt-0.5 shrink-0" />
                {t.demoNote}
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-4xl leading-tight sm:text-5xl">{name}</h1>
              <FavoriteButton productId={p.id} name={name} className="mt-1 shrink-0 border border-line" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Price
                value={price}
                from={p.pricingMode !== "fixed"}
                compareAt={p.pricingMode === "fixed" ? p.compareAtPrice : null}
                locale={locale}
                className="text-xl"
              />
              <span className={`badge ${orderable ? "bg-sage-light text-wine" : "bg-charcoal/85 text-ivory"}`}>{dict.common.stock[stock]}</span>
              {p.stockQuantity != null && p.stockQuantity > 0 && p.stockQuantity <= 5 ? (
                <span className="text-xs text-muted">{fmt(t.stockLeft, { n: p.stockQuantity })}</span>
              ) : null}
            </div>
            <p className="mt-4 text-lg leading-relaxed text-muted">{pick(locale, p.shortDescription, p.shortDescriptionRu)}</p>

            <div className="mt-8">
              <Suspense>
                <ProductConfigurator
                  product={{ id: p.id, slug: p.slug, name, image: p.images[0]?.url ?? null, floristId: florist.id, floristName: florist.name }}
                  pricing={pricing}
                  colors={colors}
                  addons={addons.filter((a) => a.productId !== p.id)}
                  orderable={orderable}
                />
              </Suspense>
            </div>

            <p className="mt-6">
              <FloristLink florist={florist} locale={locale} />
            </p>

            <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <li className="flex items-center gap-2.5 text-charcoal/80">
                <ClockIcon size={18} className="text-wine" /> {prepLabel(locale, p.prepTimeMinutes)}
              </li>
              <li className="flex items-center gap-2.5 text-charcoal/80">
                <TruckIcon size={18} className="text-wine" />
                <Link href={lp("/yetkazib-berish")} className="underline-offset-4 hover:underline">
                  {t.deliveryTerms}
                </Link>
              </li>
            </ul>

            <div className="mt-10 space-y-8 border-t border-line pt-8">
              <section>
                <h2 className="font-sans text-base font-semibold">{t.description}</h2>
                <p className="mt-2 leading-relaxed text-charcoal/85">{description}</p>
              </section>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {varieties.length ? (
                  <div>
                    <dt className="text-muted">{t.flowers}</dt>
                    <dd className="mt-0.5">{varieties.join(", ")}</dd>
                  </div>
                ) : null}
                {p.stemCount ? (
                  <div>
                    <dt className="text-muted">{t.stems}</dt>
                    <dd className="mt-0.5">{fmt(dict.common.pieces, { n: p.stemCount })}</dd>
                  </div>
                ) : null}
                {sizeLabel ? (
                  <div>
                    <dt className="text-muted">{t.size}</dt>
                    <dd className="mt-0.5">{sizeLabel}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-muted">{t.priceUpdated}</dt>
                  <dd className="mt-0.5">{formatDateTime(p.priceUpdatedAt).slice(0, 10)}</dd>
                </div>
              </dl>
              {care ? (
                <section>
                  <h2 className="font-sans text-base font-semibold">{t.care}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal/85">{care}</p>
                </section>
              ) : null}
              {categories.length ? (
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <Link key={c.id} href={lp(`/katalog/${c.slug}`)} className="chip py-1 text-xs">
                      {c.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="container-page mt-24">
            <CardGridSkeleton count={4} />
          </div>
        }
      >
        <Related productId={p.id} categoryIds={categories.map((c) => c.id)} orderable={orderable} locale={locale} />
      </Suspense>
      <RecentlyViewed excludeId={p.id} />
    </>
  );
}
