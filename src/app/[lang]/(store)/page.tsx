import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ProductCard, ProductGrid } from "@/components/store/product-card";
import { Newsletter, RecentlyViewed } from "@/components/store/widgets";
import { CheckIcon, ClockIcon, GiftIcon, InstagramIcon, TelegramIcon, TruckIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/primitives";
import { fmt, localePath } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";
import { BUDGETS, getCategories, listProducts } from "@/lib/catalog";
import { getDeliveryConfig } from "@/lib/delivery";
import { formatUZS } from "@/lib/format";
import { availablePaymentMethods } from "@/lib/payments/config";
import { getSettings, telegramLink } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: alternates(await getLocale(), "/") };
}

/** Editorial (mood) photos — Unsplash, credited on /rasm-mualliflari. Never used as product photos. */
const ED = (name: string) => `/images/editorial/${name}.webp`;
const GALLERY: [string, string][] = [
  ["peonies-dark", "aspect-square"],
  ["wrapped-pink-roses", "aspect-[3/4]"],
  ["fuchsia-gerbera", "aspect-[4/3]"],
  ["kraft-tulips", "aspect-[4/5]"],
  ["rose-dome", "aspect-[3/2]"],
  ["white-roses-kraft", "aspect-[3/4]"],
  ["orange-tulips", "aspect-[5/6]"],
  ["peonies-soft", "aspect-[3/4]"],
];

/** Arch frame — a nod to the pointed arches of Uzbek architecture; used sparingly as the brand's signature shape. */
const ARCH = "rounded-t-[999px] rounded-b-[1.25rem]";

export default async function HomePage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const t = dict.home;
  const seeAll = dict.common.seeAll;
  const lp = (p: string) => localePath(locale, p);
  const uzs = (n: number) => formatUZS(n, locale);

  const [bestsellers, newest, seasonal, premium, gifts, flowers, occasions, delivery, settings, cheapest] = await Promise.all([
    listProducts({ sort: "popular", perPage: 8, inStock: true, locale }),
    listProducts({ sort: "new", perPage: 8, inStock: true, locale }),
    listProducts({ categories: ["kuzgi-kolleksiya"], perPage: 2, sort: "popular", locale }),
    listProducts({ categories: ["premium-guldastalar"], perPage: 2, sort: "popular", inStock: true, locale }),
    listProducts({ categories: ["sovgalar"], perPage: 4, includeAddons: true, sort: "price_asc", locale }),
    getCategories("flower", locale),
    getCategories("occasion", locale),
    getDeliveryConfig(locale),
    getSettings(),
    listProducts({ sort: "price_asc", perPage: 1, inStock: true, locale }),
  ]);
  const { store, checkout } = settings;
  const minPrice = cheapest.items[0]?.price;
  const tg = telegramLink(store.telegramUsername);
  const contactHref = tg ?? (store.phone ? `tel:${store.phone}` : null);
  const methods = availablePaymentMethods(checkout, locale).map((m) => m.label);
  // One large + four small tiles fill the mosaic exactly (2 rows on desktop, 3 on phones).
  const flowerOrder = ["atirgullar", "lolalar", "pionlar", "gortenziya", "xrizantemalar"];
  const popularFlowers = flowerOrder.map((slug) => flowers.find((c) => c.slug === slug)).filter((c) => c != null);
  const faq = Object.values(t.faq.items).map(([q, a]) => [q, fmt(a, { methods: methods.join(", ") || "—" })] as const);

  return (
    <>
      {/* 1. Hero */}
      <section className="relative overflow-hidden bg-plum text-ivory" aria-labelledby="hero-h">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-cherry/30 blur-[120px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-fuchsia/15 blur-[110px]" />
        <div className="container-page relative grid items-center gap-12 pt-10 pb-16 sm:pt-14 lg:min-h-[calc(100svh-7.75rem)] lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:py-16">
          <div>
            <p className="eyebrow animate-fade-up text-petal/80">{t.hero.eyebrow}</p>
            <h1 id="hero-h" className="display-xl mt-6 text-ivory">
              <span className="block animate-fade-up anim-delay-1">{t.hero.titleA} </span>
              <span className="block animate-fade-up anim-delay-2">
                {t.hero.titleB} <em className="font-normal text-petal-deep italic">{t.hero.titleAccent}</em>{" "}
              </span>
              <span className="block animate-fade-up anim-delay-3">{t.hero.titleC}</span>
            </h1>
            <p className="mt-7 max-w-xl animate-fade-up text-lg leading-relaxed text-ivory/75 anim-delay-3">{t.hero.text}</p>
            <div className="mt-9 flex animate-fade-up flex-wrap gap-3 anim-delay-3">
              <Link href={lp("/katalog")} className="btn-accent px-8 py-4 text-[15px]">
                {t.hero.ctaChoose}
              </Link>
              <Link href={lp("/katalog/premium-guldastalar")} className="btn-ghost-light px-8 py-4 text-[15px]">
                {t.hero.ctaCollection}
              </Link>
            </div>
            <ul className="mt-12 grid max-w-xl gap-4 border-t border-ivory/15 pt-6 text-sm text-ivory/80 sm:grid-cols-3">
              <li className="flex items-center gap-2.5">
                <ClockIcon className="shrink-0 text-coral" /> {t.hero.perkTime}
              </li>
              <li className="flex items-center gap-2.5">
                <TruckIcon className="shrink-0 text-coral" /> {t.hero.perkPrice}
              </li>
              <li className="flex items-center gap-2.5">
                <GiftIcon className="shrink-0 text-coral" /> {t.hero.perkGifts}
              </li>
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className={`relative aspect-[4/5] overflow-hidden ${ARCH} animate-slow-zoom bg-plum-soft shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)]`}>
              <Image
                src={ED("hero-red-roses")}
                alt={t.hero.imageAlt}
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 42vw"
                className="parallax object-cover object-[50%_35%]"
              />
            </div>
            <div className="absolute -bottom-6 -left-4 h-32 w-32 overflow-hidden rounded-full border-4 border-plum shadow-xl sm:-left-10 sm:h-44 sm:w-44">
              <Image src={ED("burgundy-roses")} alt={t.hero.detailAlt} fill sizes="176px" className="object-cover" />
            </div>
            {minPrice ? (
              <div className="absolute top-8 -right-2 rounded-2xl bg-ivory px-5 py-4 text-plum shadow-[var(--shadow-lift)] sm:-right-6">
                <p className="text-xs text-muted">{t.hero.priceFrom}</p>
                <p className="font-display text-2xl text-wine">{fmt(dict.common.priceFrom, { price: uzs(minPrice) })}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* 2. Bestsellers */}
      <section className="container-page mt-24" aria-labelledby="best-h">
        <SectionHeading eyebrow={t.best.eyebrow} title={t.best.title} href={lp("/katalog?saralash=popular")} linkLabel={seeAll} />
        <span id="best-h" className="sr-only">
          {t.best.title}
        </span>
        <ProductGrid items={bestsellers.items} locale={locale} />
      </section>

      {/* 3. Occasions + budget */}
      <section className="mt-28 bg-petal/45 py-20 sm:py-24" aria-label={t.occasions.aria}>
        <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div data-reveal>
            <p className="eyebrow mb-3">{t.occasions.eyebrow}</p>
            <h2 className="display-lg text-plum">{t.occasions.title}</h2>
            <p className="mt-5 max-w-sm leading-relaxed text-muted">{t.occasions.text}</p>
            <p className="mt-10 mb-3 text-sm font-semibold text-plum">{t.occasions.budgetTitle}</p>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((b, i) => {
                const qs = new URLSearchParams();
                if (b.min != null) qs.set("narx_min", String(b.min));
                if (b.max != null) qs.set("narx_max", String(b.max));
                return (
                  <Link key={i} href={lp(`/katalog?${qs}`)} className="chip border-wine/20 bg-ivory/70 hover:border-wine hover:bg-ivory">
                    {t.budgets[i]}
                  </Link>
                );
              })}
            </div>
          </div>
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {occasions.map((o, i) => (
              <li key={o.id} data-reveal style={{ "--i": i % 6 } as React.CSSProperties}>
                <Link
                  href={lp(`/katalog/${o.slug}`)}
                  className="group flex items-baseline gap-4 border-b border-wine/15 py-4 transition-colors hover:border-fuchsia"
                >
                  <span className="w-6 shrink-0 font-display text-sm text-fuchsia italic">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-display text-2xl text-plum transition group-hover:translate-x-1 group-hover:text-wine sm:text-[1.7rem]">{o.name}</span>
                  <span aria-hidden="true" className="ml-auto text-wine opacity-0 transition group-hover:opacity-100">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. New arrivals — horizontal rail */}
      {newest.items.length ? (
        <section className="mt-28" aria-label={t.newest.title}>
          <div className="container-page">
            <SectionHeading eyebrow={t.newest.eyebrow} title={t.newest.title} href={lp("/katalog?saralash=new")} linkLabel={seeAll} />
          </div>
          <div className="container-page">
            <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:thin] sm:-mx-6 sm:gap-6 sm:px-6 lg:-mx-8 lg:px-8" tabIndex={0} aria-label={t.newest.hint}>
              {newest.items.map((p, i) => (
                <div key={p.id} className="w-[68%] shrink-0 snap-start sm:w-[40%] md:w-[30%] lg:w-[23%]">
                  <ProductCard p={p} locale={locale} index={i} />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 5. Signature collection */}
      {premium.items.length ? (
        <section className="mt-28 overflow-hidden bg-plum py-20 text-ivory sm:py-28" aria-labelledby="sig-h">
          <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.25rem] lg:aspect-[5/6]" data-reveal="image">
              <Image src={ED("moody-bouquet")} alt={t.signature.imageAlt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="parallax object-cover" />
            </div>
            <div>
              <div data-reveal>
                <p className="eyebrow mb-4 text-petal/80">{t.signature.eyebrow}</p>
                <h2 id="sig-h" className="display-lg text-ivory">
                  {t.signature.title}
                </h2>
                <p className="mt-5 max-w-lg leading-relaxed text-ivory/75">{t.signature.text}</p>
                <Link href={lp("/katalog/premium-guldastalar")} className="btn-light mt-8">
                  {t.signature.cta}
                </Link>
              </div>
              <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6">
                {premium.items.map((p, i) => (
                  <ProductCard key={p.id} p={p} locale={locale} index={i} dark />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* 6. Flower types — asymmetric mosaic */}
      <section className="container-page mt-28" aria-label={t.flowers.title}>
        <SectionHeading eyebrow={t.flowers.eyebrow} title={t.flowers.title} href={lp("/katalog")} linkLabel={t.flowers.link} />
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {popularFlowers.map((c, i) => (
            <Link
              key={c.id}
              href={lp(`/katalog/${c.slug}`)}
              data-reveal
              style={{ "--i": i % 4 } as React.CSSProperties}
              className={`group relative overflow-hidden rounded-[var(--radius-card)] bg-cream ${i === 0 ? "col-span-2 row-span-2 aspect-square lg:aspect-auto" : "aspect-square"}`}
            >
              {c.imageUrl ? (
                <Image
                  src={c.imageUrl}
                  alt=""
                  fill
                  sizes={i === 0 ? "(max-width: 1024px) 100vw, 50vw" : "(max-width: 1024px) 50vw, 25vw"}
                  className="object-cover transition duration-[1200ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.06]"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-plum/70 via-plum/5 to-transparent" />
              <span className={`absolute bottom-4 left-4 font-display text-ivory sm:bottom-5 sm:left-5 ${i === 0 ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"}`}>
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 7. Seasonal collection */}
      {seasonal.items.length ? (
        <section className="container-page mt-28" aria-labelledby="season-h">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div className="order-2 lg:order-1">
              <div data-reveal>
                <p className="eyebrow mb-3 text-cherry">{t.seasonal.eyebrow}</p>
                <h2 id="season-h" className="display-lg text-plum">
                  {t.seasonal.title}
                </h2>
                <p className="mt-5 max-w-md leading-relaxed text-muted">{t.seasonal.text}</p>
                <Link href={lp("/katalog/kuzgi-kolleksiya")} className="btn-primary mt-7">
                  {t.seasonal.cta}
                </Link>
              </div>
              <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6">
                {seasonal.items.map((p, i) => (
                  <ProductCard key={p.id} p={p} locale={locale} index={i} />
                ))}
              </div>
            </div>
            <div className={`relative order-1 aspect-[4/5] overflow-hidden ${ARCH} bg-cream lg:order-2`} data-reveal="image">
              <Image src={ED("coral-peony")} alt={t.seasonal.imageAlt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
            </div>
          </div>
        </section>
      ) : null}

      {/* 8. Why Gulzor */}
      <section className="mt-28 bg-cream py-20 sm:py-24" aria-labelledby="why-h">
        <div className="container-page">
          <div className="max-w-2xl" data-reveal>
            <p className="eyebrow mb-3">{t.why.eyebrow}</p>
            <h2 id="why-h" className="display-lg text-plum">
              {t.why.title}
            </h2>
          </div>
          <ol className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {t.why.items.map(([title, text], i) => (
              <li key={title} className="border-t border-wine/20 pt-6" data-reveal style={{ "--i": i } as React.CSSProperties}>
                <span className="font-display text-5xl text-fuchsia italic">0{i + 1}</span>
                <h3 className="mt-4 font-sans text-lg font-semibold text-plum">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 9. Gift experience */}
      <section className="container-page mt-28" aria-labelledby="gift-h">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className={`relative aspect-[4/5] overflow-hidden ${ARCH} bg-cream`} data-reveal="image">
              <Image src={ED("gift-box-roses")} alt={t.gift.imageAlt} fill sizes="(max-width: 1024px) 90vw, 45vw" className="object-cover" />
            </div>
            <div className="absolute -right-3 -bottom-8 w-[42%] overflow-hidden rounded-[1.25rem] border-[6px] border-ivory shadow-[var(--shadow-lift)] sm:-right-8" data-reveal="image">
              <div className="relative aspect-[3/4]">
                <Image src={ED("gift-hand-pink")} alt={t.gift.detailAlt} fill sizes="240px" className="object-cover" />
              </div>
            </div>
          </div>
          <div data-reveal>
            <p className="eyebrow mb-3">{t.gift.eyebrow}</p>
            <h2 id="gift-h" className="display-lg text-plum">
              {t.gift.title}
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-muted">{t.gift.text}</p>
            <ul className="mt-8 space-y-3">
              {t.gift.points.map((x) => (
                <li key={x} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fuchsia/10 text-fuchsia">
                    <CheckIcon size={14} />
                  </span>
                  <span className="text-charcoal">{x}</span>
                </li>
              ))}
            </ul>
            <Link href={lp("/katalog/sovgalar")} className="btn-primary mt-9">
              {t.gift.cta}
            </Link>
          </div>
        </div>
        {gifts.items.length ? (
          <div className="mt-20">
            <ProductGrid items={gifts.items} locale={locale} />
          </div>
        ) : null}
      </section>

      {/* 10. Gallery (mood photos, credited) */}
      <section className="container-page mt-28" aria-labelledby="gallery-h">
        <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" data-reveal>
          <div>
            <p className="eyebrow mb-3">{t.gallery.eyebrow}</p>
            <h2 id="gallery-h" className="display-lg text-plum">
              {t.gallery.title}
            </h2>
            <p className="mt-3 text-muted">{t.gallery.text}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {store.instagramUrl ? (
              <a href={store.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                <InstagramIcon size={16} /> {t.gallery.instagram}
              </a>
            ) : null}
            <Link href={lp("/rasm-mualliflari")} className="btn-secondary btn-sm">
              {t.gallery.credits}
            </Link>
          </div>
        </div>
        <div className="columns-2 gap-3 sm:gap-5 lg:columns-4">
          {GALLERY.map(([name, aspect], i) => (
            <div key={name} className={`relative mb-3 overflow-hidden rounded-[var(--radius-card)] bg-cream sm:mb-5 ${aspect}`} data-reveal="image" style={{ "--i": i % 4 } as React.CSSProperties}>
              <Image src={ED(name)} alt="" fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover transition duration-[1200ms] hover:scale-[1.05]" />
            </div>
          ))}
        </div>
      </section>

      {/* 11. Delivery coverage */}
      <section className="container-page mt-28" aria-label={t.delivery.title}>
        <div className="overflow-hidden rounded-[1.5rem] border border-line bg-white lg:grid lg:grid-cols-[1fr_1.4fr]" data-reveal>
          <div className="relative overflow-hidden bg-wine p-8 text-ivory sm:p-12">
            <Image src={ED("hand-coral-bouquet")} alt="" fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover opacity-40 mix-blend-multiply" />
            <div className="relative">
              <p className="eyebrow mb-3 text-ivory/70">{t.delivery.eyebrow}</p>
              <h2 className="display-lg text-ivory">{t.delivery.title}</h2>
              <p className="mt-4 max-w-sm text-ivory/80">{t.delivery.text}</p>
              <Link href={lp("/yetkazib-berish")} className="btn-light mt-7">
                {t.delivery.more}
              </Link>
            </div>
          </div>
          <div className="divide-y divide-line p-6 sm:p-10">
            {delivery.regions.length === 0 ? (
              <p className="text-muted">{t.delivery.none}</p>
            ) : (
              delivery.regions.flatMap((r) =>
                r.zones.map((z) => (
                  <div key={z.id} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div>
                      <p className="font-semibold text-plum">
                        {r.name} — {z.name}
                      </p>
                      {z.description ? <p className="mt-0.5 text-sm text-muted">{z.description}</p> : null}
                    </div>
                    <div className="shrink-0 text-sm sm:text-right">
                      <p className="font-semibold text-wine">{uzs(z.fee)}</p>
                      {z.freeFrom ? <p className="text-muted">{fmt(t.delivery.freeFrom, { amount: uzs(z.freeFrom) })}</p> : null}
                    </div>
                  </div>
                )),
              )
            )}
          </div>
        </div>
      </section>

      {/* 12. FAQ */}
      <section className="container-page mt-28" aria-labelledby="faq-h">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="lg:sticky lg:top-36 lg:self-start" data-reveal>
            <p className="eyebrow mb-3">{t.faq.eyebrow}</p>
            <h2 id="faq-h" className="display-lg text-plum">
              {t.faq.title}
            </h2>
            {contactHref ? (
              <p className="mt-6 text-muted">
                {t.faq.contact}{" "}
                <a href={contactHref} target={tg ? "_blank" : undefined} rel={tg ? "noopener noreferrer" : undefined} className="font-semibold text-wine underline underline-offset-4">
                  {t.faq.contactLink}
                </a>
              </p>
            ) : null}
          </div>
          <div className="divide-y divide-line border-y border-line">
            {faq.map(([q, a]) => (
              <details key={q} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left font-display text-xl text-plum transition hover:text-wine sm:text-2xl [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-wine transition duration-300 group-open:rotate-45 group-open:border-wine">
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 13. Newsletter & support */}
      <section className="container-page mt-28" aria-label={t.newsletter.aria}>
        <div className="relative grid gap-10 overflow-hidden rounded-[1.5rem] bg-plum px-6 py-14 text-ivory sm:px-12 lg:grid-cols-2 lg:items-center" data-reveal>
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-fuchsia/20 blur-[90px]" />
          <div className="relative">
            <h2 className="display-lg text-ivory">{t.newsletter.title}</h2>
            <p className="mt-4 text-ivory/75">{t.newsletter.text}</p>
            {tg ? (
              <a href={tg} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-petal hover:underline">
                <TelegramIcon size={18} /> {t.newsletter.telegram}
              </a>
            ) : null}
          </div>
          <div className="relative">
            <Newsletter />
          </div>
        </div>
      </section>

      <RecentlyViewed />
    </>
  );
}
