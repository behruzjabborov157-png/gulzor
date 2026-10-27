import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TrackRecent } from "@/components/store/client-widgets";
import { FavoriteButton } from "@/components/store/client-widgets";
import { Gallery } from "@/components/store/gallery";
import { ProductConfigurator } from "@/components/store/product-configurator";
import { ProductGrid } from "@/components/store/product-card";
import { RecentlyViewed } from "@/components/store/widgets";
import { ClockIcon, InfoIcon, TruckIcon } from "@/components/ui/icons";
import { Breadcrumbs, Price } from "@/components/ui/primitives";
import { CardGridSkeleton } from "@/components/ui/skeletons";
import { getAddons, getProductBySlug, getRelated, isOrderable, STOCK_LABEL, toPricing } from "@/lib/catalog";
import { formatDateTime } from "@/lib/format";
import { fromPrice } from "@/lib/pricing";
import { siteUrl } from "@/lib/settings";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getProductBySlug((await params).slug);
  if (!data) return { title: "Mahsulot topilmadi" };
  const p = data.product;
  return {
    title: p.seoTitle || `${p.name} — narxi va buyurtma`,
    description: p.seoDescription || `${p.shortDescription} ${p.description}`.slice(0, 160),
    alternates: { canonical: `/gul/${p.slug}` },
    openGraph: { title: p.name, images: p.images[0] ? [{ url: p.images[0].url }] : undefined },
  };
}

function prepLabel(min: number) {
  if (min >= 1440) return `${Math.round(min / 1440)} kun oldin buyurtma bering`;
  if (min >= 60) return `Tayyorlash: ~${Math.round(min / 60)} soat`;
  return `Tayyorlash: ~${min} daqiqa`;
}

/** Streams in after the main product content. Shows alternatives when the product cannot be ordered. */
async function Related({ productId, categoryIds, orderable }: { productId: number; categoryIds: number[]; orderable: boolean }) {
  const related = await getRelated(productId, categoryIds, 4);
  if (!related.length) return null;
  return (
    <section className="container-page mt-24" aria-labelledby="rel-h">
      <h2 id="rel-h" className="mb-8 text-3xl sm:text-4xl">{orderable ? "Sizga yoqishi mumkin" : "O‘xshash guldastalar"}</h2>
      <ProductGrid items={related} />
    </section>
  );
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) notFound();
  const { product: p, variants, categories, stock } = data;
  const orderable = isOrderable(stock);
  const pricing = toPricing(p, variants);
  const addons = p.isAddon ? [] : await getAddons();
  const primary = categories.find((c) => c.id === p.primaryCategoryId) ?? categories[0];
  const price = fromPrice(pricing);

  // Structured data only for real (non-demo) products, so search engines never index sample prices.
  const jsonLd = p.isDemo
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "Product",
        name: p.name,
        description: p.description,
        image: p.images.map((i) => siteUrl() + i.url),
        sku: String(p.id),
        offers: {
          "@type": "Offer",
          priceCurrency: "UZS",
          price,
          availability: orderable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: `${siteUrl()}/gul/${p.slug}`,
        },
      };

  return (
    <>
      <TrackRecent id={p.id} />
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /> : null}
      <div className="container-page pt-8">
        <Breadcrumbs
          items={[
            { href: "/", label: "Bosh sahifa" },
            { href: "/katalog", label: "Katalog" },
            ...(primary ? [{ href: `/katalog/${primary.slug}`, label: primary.name }] : []),
            { label: p.name },
          ]}
        />
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="lg:sticky lg:top-36 lg:self-start">
            <Gallery images={p.images.map((i) => ({ url: i.url, alt: i.alt }))} name={p.name} />
            {p.isDemo ? (
              <p className="mt-3 flex items-start gap-2 text-xs text-muted">
                <InfoIcon size={16} className="mt-0.5 shrink-0" />
                Namuna mahsulot: rasm litsenziyalangan illyustratsiya, narx va tarkib do‘kon tomonidan tasdiqlanishi kerak.
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-4xl leading-tight sm:text-5xl">{p.name}</h1>
              <FavoriteButton productId={p.id} name={p.name} className="mt-1 shrink-0 border border-line" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Price value={price} from={p.pricingMode !== "fixed"} compareAt={p.pricingMode === "fixed" ? p.compareAtPrice : null} className="text-xl" />
              <span className={`badge ${orderable ? "bg-sage-light text-forest" : "bg-charcoal/85 text-ivory"}`}>{STOCK_LABEL[stock]}</span>
              {p.stockQuantity != null && p.stockQuantity > 0 && p.stockQuantity <= 5 ? (
                <span className="text-xs text-muted">Omborda: {p.stockQuantity} dona</span>
              ) : null}
            </div>
            <p className="mt-4 text-lg leading-relaxed text-muted">{p.shortDescription}</p>

            <div className="mt-8">
              <Suspense>
                <ProductConfigurator
                  product={{ id: p.id, slug: p.slug, name: p.name, image: p.images[0]?.url ?? null }}
                  pricing={pricing}
                  colors={p.colorOptions}
                  addons={addons.filter((a) => a.productId !== p.id)}
                  orderable={orderable}
                />
              </Suspense>
            </div>

            <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <li className="flex items-center gap-2.5 text-charcoal/80">
                <ClockIcon size={18} className="text-forest" /> {prepLabel(p.prepTimeMinutes)}
              </li>
              <li className="flex items-center gap-2.5 text-charcoal/80">
                <TruckIcon size={18} className="text-forest" />
                <Link href="/yetkazib-berish" className="underline-offset-4 hover:underline">
                  Yetkazib berish shartlari
                </Link>
              </li>
            </ul>

            <div className="mt-10 space-y-8 border-t border-line pt-8">
              <section>
                <h2 className="font-sans text-base font-semibold">Tavsif</h2>
                <p className="mt-2 leading-relaxed text-charcoal/85">{p.description}</p>
              </section>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {p.flowerVarieties.length ? (
                  <div>
                    <dt className="text-muted">Gullar</dt>
                    <dd className="mt-0.5">{p.flowerVarieties.join(", ")}</dd>
                  </div>
                ) : null}
                {p.stemCount ? (
                  <div>
                    <dt className="text-muted">Gullar soni</dt>
                    <dd className="mt-0.5">{p.stemCount} dona</dd>
                  </div>
                ) : null}
                {p.sizeLabel ? (
                  <div>
                    <dt className="text-muted">O‘lcham</dt>
                    <dd className="mt-0.5">{p.sizeLabel}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-muted">Narx yangilangan</dt>
                  <dd className="mt-0.5">{formatDateTime(p.priceUpdatedAt).slice(0, 10)}</dd>
                </div>
              </dl>
              {p.careInstructions ? (
                <section>
                  <h2 className="font-sans text-base font-semibold">Parvarish</h2>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal/85">{p.careInstructions}</p>
                </section>
              ) : null}
              {categories.length ? (
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <Link key={c.id} href={`/katalog/${c.slug}`} className="chip py-1 text-xs">
                      {c.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={<div className="container-page mt-24"><CardGridSkeleton count={4} /></div>}>
        <Related productId={p.id} categoryIds={categories.map((c) => c.id)} orderable={orderable} />
      </Suspense>
      <RecentlyViewed excludeId={p.id} />
    </>
  );
}
