import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ProductCard, ProductGrid } from "@/components/store/product-card";
import { Newsletter, RecentlyViewed } from "@/components/store/widgets";
import { ClockIcon, GiftIcon, InstagramIcon, TelegramIcon, TruckIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/primitives";
import { fmt, localePath } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";
import { BUDGETS, getCategories, listProducts } from "@/lib/catalog";
import { getDeliveryConfig } from "@/lib/delivery";
import { formatUZS } from "@/lib/format";
import { getSettings, telegramLink } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: alternates(await getLocale(), "/") };
}

export default async function HomePage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const t = dict.home;
  const seeAll = dict.common.seeAll;
  const lp = (p: string) => localePath(locale, p);
  const uzs = (n: number) => formatUZS(n, locale);

  const [bestsellers, newest, seasonal, premium, gifts, flowers, occasions, delivery, { store }, cheapest] = await Promise.all([
    listProducts({ sort: "popular", perPage: 8, inStock: true, locale }),
    listProducts({ sort: "new", perPage: 4, inStock: true, locale }),
    listProducts({ categories: ["kuzgi-kolleksiya"], perPage: 4, sort: "popular", locale }),
    listProducts({ categories: ["premium-guldastalar"], perPage: 4, sort: "popular", inStock: true, locale }),
    listProducts({ categories: ["sovgalar"], perPage: 4, includeAddons: true, sort: "price_asc", locale }),
    getCategories("flower", locale),
    getCategories("occasion", locale),
    getDeliveryConfig(locale),
    getSettings(),
    listProducts({ sort: "price_asc", perPage: 1, inStock: true, locale }),
  ]);
  const minPrice = cheapest.items[0]?.price;
  const tg = telegramLink(store.telegramUsername);
  const popularFlowers = flowers.filter((c) =>
    ["atirgullar", "lolalar", "xrizantemalar", "eustoma", "chinnigullar", "pionlar", "gortenziya", "liliyalar"].includes(c.slug),
  );

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-page grid items-center gap-8 pt-6 pb-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-14 lg:pb-20">
          <div className="order-2 animate-fade-up lg:order-1">
            <p className="eyebrow mb-4">{t.hero.eyebrow}</p>
            <h1 className="text-[2.6rem] leading-[1.05] text-forest sm:text-6xl lg:text-7xl">{t.hero.title}</h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">{t.hero.text}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={lp("/katalog")} className="btn-primary">
                {t.hero.ctaChoose}
              </Link>
              <Link href={lp("/katalog/guldastalar")} className="btn-secondary">
                {t.hero.ctaOrder}
              </Link>
            </div>
            <ul className="mt-10 grid max-w-lg gap-4 text-sm text-charcoal/80 sm:grid-cols-3">
              <li className="flex items-center gap-2.5">
                <ClockIcon className="shrink-0 text-forest" /> {t.hero.perkTime}
              </li>
              <li className="flex items-center gap-2.5">
                <TruckIcon className="shrink-0 text-forest" /> {t.hero.perkPrice}
              </li>
              <li className="flex items-center gap-2.5">
                <GiftIcon className="shrink-0 text-forest" /> {t.hero.perkGifts}
              </li>
            </ul>
          </div>
          <div className="relative order-1 lg:order-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-blush/40 sm:aspect-[5/4] lg:aspect-[4/5]">
              <Image src="/images/demo/bridal-pastel.webp" alt={t.hero.imageAlt} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
            </div>
            {minPrice ? (
              <div className="absolute -bottom-5 left-5 hidden rounded-2xl bg-white/95 px-5 py-4 shadow-[var(--shadow-soft)] backdrop-blur sm:block">
                <p className="text-xs text-muted">{t.hero.priceFrom}</p>
                <p className="font-display text-2xl text-forest">{fmt(dict.common.priceFrom, { price: uzs(minPrice) })}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Bestsellers */}
      <section className="container-page mt-10" aria-labelledby="best-h">
        <SectionHeading eyebrow={t.best.eyebrow} title={t.best.title} href={lp("/katalog?saralash=popular")} linkLabel={seeAll} />
        <span id="best-h" className="sr-only">
          {t.best.title}
        </span>
        <ProductGrid items={bestsellers.items} locale={locale} />
      </section>

      {/* Popular flowers */}
      <section className="container-page mt-24" aria-label={t.flowers.title}>
        <SectionHeading eyebrow={t.flowers.eyebrow} title={t.flowers.title} href={lp("/katalog")} linkLabel={t.flowers.link} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
          {popularFlowers.map((c) => (
            <Link key={c.id} href={lp(`/katalog/${c.slug}`)} className="group relative aspect-square overflow-hidden rounded-[var(--radius-card)] bg-blush/40">
              {c.imageUrl ? (
                <Image src={c.imageUrl} alt="" fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover transition duration-700 group-hover:scale-105" />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/55 via-transparent to-transparent" />
              <span className="absolute bottom-4 left-4 font-display text-2xl text-ivory">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Budget */}
      <section className="container-page mt-24" aria-label={t.budget.aria}>
        <SectionHeading eyebrow={t.budget.eyebrow} title={t.budget.title} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BUDGETS.map((b, i) => {
            const qs = new URLSearchParams();
            if (b.min != null) qs.set("narx_min", String(b.min));
            if (b.max != null) qs.set("narx_max", String(b.max));
            return (
              <Link
                key={i}
                href={lp(`/katalog?${qs}`)}
                className="card flex items-center justify-between px-6 py-6 transition hover:border-forest/40 hover:shadow-[var(--shadow-soft)]"
              >
                <span className="font-display text-2xl text-forest">{t.budgets[i]}</span>
                <span aria-hidden="true" className="text-forest">
                  →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* New arrivals */}
      {newest.items.length ? (
        <section className="container-page mt-24" aria-label={t.newest.title}>
          <SectionHeading eyebrow={t.newest.eyebrow} title={t.newest.title} href={lp("/katalog?saralash=new")} linkLabel={seeAll} />
          <ProductGrid items={newest.items} locale={locale} />
        </section>
      ) : null}

      {/* Occasions */}
      <section className="mt-24 bg-blush/35 py-20" aria-label={t.occasions.aria}>
        <div className="container-page">
          <SectionHeading eyebrow={t.occasions.eyebrow} title={t.occasions.title} />
          <div className="flex flex-wrap gap-2.5">
            {occasions.map((o) => (
              <Link key={o.id} href={lp(`/katalog/${o.slug}`)} className="chip bg-white/80 px-5 py-2.5 text-[15px]">
                {o.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Seasonal collection */}
      {seasonal.items.length ? (
        <section className="container-page mt-24" aria-label={t.seasonal.title}>
          <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:items-center">
            <div>
              <p className="eyebrow mb-2">{t.seasonal.eyebrow}</p>
              <h2 className="text-4xl">{t.seasonal.title}</h2>
              <p className="mt-3 text-muted">{t.seasonal.text}</p>
              <Link href={lp("/katalog/kuzgi-kolleksiya")} className="btn-secondary mt-6">
                {t.seasonal.cta}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              {seasonal.items.slice(0, 2).map((p) => (
                <ProductCard key={p.id} p={p} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Premium */}
      {premium.items.length ? (
        <section className="container-page mt-24" aria-label={t.premium.title}>
          <SectionHeading eyebrow={t.premium.eyebrow} title={t.premium.title} href={lp("/katalog/premium-guldastalar")} linkLabel={seeAll} />
          <ProductGrid items={premium.items} locale={locale} />
        </section>
      ) : null}

      {/* Gifts */}
      {gifts.items.length ? (
        <section className="container-page mt-24" aria-label={t.gifts.title}>
          <SectionHeading eyebrow={t.gifts.eyebrow} title={t.gifts.title} description={t.gifts.text} href={lp("/katalog/sovgalar")} linkLabel={seeAll} />
          <ProductGrid items={gifts.items} locale={locale} />
        </section>
      ) : null}

      {/* How it works */}
      <section className="container-page mt-24" aria-labelledby="how-h">
        <SectionHeading eyebrow={t.how.eyebrow} title={t.how.title} />
        <span id="how-h" className="sr-only">
          {t.how.title}
        </span>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.how.steps.map(([title, d], i) => (
            <li key={title} className="card p-6">
              <span className="font-display text-4xl text-blush-deep">0{i + 1}</span>
              <h3 className="mt-3 font-sans text-base font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Delivery areas */}
      <section className="container-page mt-24" aria-label={t.delivery.title}>
        <div className="card overflow-hidden lg:grid lg:grid-cols-[1fr_1.4fr]">
          <div className="bg-forest p-8 text-ivory sm:p-10">
            <p className="eyebrow mb-3 text-ivory/70">{t.delivery.eyebrow}</p>
            <h2 className="text-4xl">{t.delivery.title}</h2>
            <p className="mt-4 text-ivory/80">{t.delivery.text}</p>
            <Link href={lp("/yetkazib-berish")} className="btn-light mt-6">
              {t.delivery.more}
            </Link>
          </div>
          <div className="divide-y divide-line p-6 sm:p-10">
            {delivery.regions.length === 0 ? (
              <p className="text-muted">{t.delivery.none}</p>
            ) : (
              delivery.regions.flatMap((r) =>
                r.zones.map((z) => (
                  <div key={z.id} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div>
                      <p className="font-semibold">
                        {r.name} — {z.name}
                      </p>
                      {z.description ? <p className="mt-0.5 text-sm text-muted">{z.description}</p> : null}
                    </div>
                    <div className="shrink-0 text-sm sm:text-right">
                      <p className="font-semibold text-forest">{uzs(z.fee)}</p>
                      {z.freeFrom ? <p className="text-muted">{fmt(t.delivery.freeFrom, { amount: uzs(z.freeFrom) })}</p> : null}
                    </div>
                  </div>
                )),
              )
            )}
          </div>
        </div>
      </section>

      {/* Instagram — only when the shop has configured a real profile */}
      {store.instagramUrl ? (
        <section className="container-page mt-24 text-center" aria-label="Instagram">
          <InstagramIcon size={28} className="mx-auto text-forest" />
          <h2 className="mt-3 text-4xl">{t.instagram.title}</h2>
          <a href={store.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-6">
            {t.instagram.cta}
          </a>
        </section>
      ) : null}

      {/* Newsletter & support */}
      <section className="container-page mt-24" aria-label={t.newsletter.aria}>
        <div className="grid gap-10 rounded-[2rem] bg-forest-deep px-6 py-12 text-ivory sm:px-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-4xl">{t.newsletter.title}</h2>
            <p className="mt-3 text-ivory/75">{t.newsletter.text}</p>
            {tg ? (
              <a href={tg} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blush hover:underline">
                <TelegramIcon size={18} /> {t.newsletter.telegram}
              </a>
            ) : null}
          </div>
          <Newsletter />
        </div>
      </section>

      <RecentlyViewed />
    </>
  );
}
