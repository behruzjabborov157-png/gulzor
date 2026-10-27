import Image from "next/image";
import Link from "next/link";
import { ProductCard, ProductGrid } from "@/components/store/product-card";
import { Newsletter, RecentlyViewed } from "@/components/store/widgets";
import { ClockIcon, GiftIcon, InstagramIcon, TelegramIcon, TruckIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/primitives";
import { BUDGETS, getCategories, listProducts } from "@/lib/catalog";
import { getDeliveryConfig } from "@/lib/delivery";
import { formatUZS } from "@/lib/format";
import { getSettings, telegramLink } from "@/lib/settings";

export default async function HomePage() {
  const [bestsellers, newest, seasonal, premium, gifts, flowers, occasions, delivery, { store }, cheapest] = await Promise.all([
    listProducts({ sort: "popular", perPage: 8, inStock: true }),
    listProducts({ sort: "new", perPage: 4, inStock: true }),
    listProducts({ categories: ["kuzgi-kolleksiya"], perPage: 4, sort: "popular" }),
    listProducts({ categories: ["premium-guldastalar"], perPage: 4, sort: "popular", inStock: true }),
    listProducts({ categories: ["sovgalar"], perPage: 4, includeAddons: true, sort: "price_asc" }),
    getCategories("flower"),
    getCategories("occasion"),
    getDeliveryConfig(),
    getSettings(),
    listProducts({ sort: "price_asc", perPage: 1, inStock: true }),
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
            <p className="eyebrow mb-4">Onlayn gul do‘koni · Toshkent</p>
            <h1 className="text-[2.6rem] leading-[1.05] text-forest sm:text-6xl lg:text-7xl">Gullar bilan unutilmas lahzalar yarating.</h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
              Har bir munosabat va har bir inson uchun mehr bilan tanlangan guldastalar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/katalog" className="btn-primary">
                Gullarni tanlash
              </Link>
              <Link href="/katalog/guldastalar" className="btn-secondary">
                Buyurtma berish
              </Link>
            </div>
            <ul className="mt-10 grid max-w-lg gap-4 text-sm text-charcoal/80 sm:grid-cols-3">
              <li className="flex items-center gap-2.5">
                <ClockIcon className="shrink-0 text-forest" /> Sana va vaqtni o‘zingiz tanlaysiz
              </li>
              <li className="flex items-center gap-2.5">
                <TruckIcon className="shrink-0 text-forest" /> Yetkazish narxi oldindan ko‘rinadi
              </li>
              <li className="flex items-center gap-2.5">
                <GiftIcon className="shrink-0 text-forest" /> Otkritka va sovg‘alar
              </li>
            </ul>
          </div>
          <div className="relative order-1 lg:order-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-blush/40 sm:aspect-[5/4] lg:aspect-[4/5]">
              <Image
                src="/images/demo/bridal-pastel.webp"
                alt="Pastel atirgul va eustomalardan yig‘ilgan guldasta"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            {minPrice ? (
              <div className="absolute -bottom-5 left-5 hidden rounded-2xl bg-white/95 px-5 py-4 shadow-[var(--shadow-soft)] backdrop-blur sm:block">
                <p className="text-xs text-muted">Guldastalar narxi</p>
                <p className="font-display text-2xl text-forest">{formatUZS(minPrice)}dan</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Bestsellers */}
      <section className="container-page mt-10" aria-labelledby="best-h">
        <SectionHeading eyebrow="Mijozlar tanlovi" title="Eng ko‘p buyurtma qilinganlar" href="/katalog?saralash=popular" />
        <span id="best-h" className="sr-only">Eng ko‘p buyurtma qilinganlar</span>
        <ProductGrid items={bestsellers.items} priorityCount={0} />
      </section>

      {/* Popular flowers */}
      <section className="container-page mt-24" aria-label="Mashhur gullar">
        <SectionHeading eyebrow="Gul turlari" title="Mashhur gullar" href="/katalog" linkLabel="Barcha gullar" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
          {popularFlowers.map((c) => (
            <Link key={c.id} href={`/katalog/${c.slug}`} className="group relative aspect-square overflow-hidden rounded-[var(--radius-card)] bg-blush/40">
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
      <section className="container-page mt-24" aria-label="Byudjet bo‘yicha guldastalar">
        <SectionHeading eyebrow="Byudjet" title="Byudjetingizga mos guldasta" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BUDGETS.map((b) => {
            const qs = new URLSearchParams();
            if (b.min != null) qs.set("narx_min", String(b.min));
            if (b.max != null) qs.set("narx_max", String(b.max));
            return (
              <Link
                key={b.label}
                href={`/katalog?${qs}`}
                className="card flex items-center justify-between px-6 py-6 transition hover:border-forest/40 hover:shadow-[var(--shadow-soft)]"
              >
                <span className="font-display text-2xl text-forest">{b.label}</span>
                <span aria-hidden="true" className="text-forest">→</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* New arrivals */}
      {newest.items.length ? (
        <section className="container-page mt-24" aria-label="Yangi guldastalar">
          <SectionHeading eyebrow="Yangiliklar" title="Yangi guldastalar" href="/katalog?saralash=new" />
          <ProductGrid items={newest.items} />
        </section>
      ) : null}

      {/* Occasions */}
      <section className="mt-24 bg-blush/35 py-20" aria-label="Munosabatlar">
        <div className="container-page">
          <SectionHeading eyebrow="Munosabat bo‘yicha" title="Qaysi kun uchun gul kerak?" />
          <div className="flex flex-wrap gap-2.5">
            {occasions.map((o) => (
              <Link key={o.id} href={`/katalog/${o.slug}`} className="chip bg-white/80 px-5 py-2.5 text-[15px]">
                {o.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Seasonal collection */}
      {seasonal.items.length ? (
        <section className="container-page mt-24" aria-label="Mavsumiy kolleksiya">
          <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:items-center">
            <div>
              <p className="eyebrow mb-2">Mavsum</p>
              <h2 className="text-4xl">Kuzgi kolleksiya</h2>
              <p className="mt-3 text-muted">Xrizantema, gortenziya va issiq ranglardagi guldastalar — kuz kayfiyatini sovg‘a qiling.</p>
              <Link href="/katalog/kuzgi-kolleksiya" className="btn-secondary mt-6">
                Kolleksiyani ko‘rish
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              {seasonal.items.slice(0, 2).map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Premium */}
      {premium.items.length ? (
        <section className="container-page mt-24" aria-label="Premium kompozitsiyalar">
          <SectionHeading eyebrow="Premium" title="Hashamatli kompozitsiyalar" href="/katalog/premium-guldastalar" />
          <ProductGrid items={premium.items} />
        </section>
      ) : null}

      {/* Gifts */}
      {gifts.items.length ? (
        <section className="container-page mt-24" aria-label="Sovg‘alar">
          <SectionHeading
            eyebrow="Qo‘shimchalar"
            title="Guldastaga sovg‘a qo‘shing"
            description="Otkritka, shokolad, yumshoq o‘yinchoq yoki vazani guldasta sahifasida bir bosishda qo‘shishingiz mumkin."
            href="/katalog/sovgalar"
          />
          <ProductGrid items={gifts.items} />
        </section>
      ) : null}

      {/* How it works */}
      <section className="container-page mt-24" aria-labelledby="how-h">
        <SectionHeading eyebrow="Oson va tez" title="Buyurtma qanday beriladi?" />
        <span id="how-h" className="sr-only">Buyurtma qanday beriladi</span>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Guldastani tanlang", "Gul turi, munosabat yoki byudjet bo‘yicha qidiring."],
            ["Moslashtiring", "O‘lcham, gullar soni, rang, otkritka va sovg‘alarni tanlang."],
            ["Manzil va vaqt", "Qabul qiluvchi manzili, sana va qulay vaqt oralig‘ini kiriting."],
            ["Buyurtmani tasdiqlang", "Buyurtma raqamini olasiz va holatini kuzatib borasiz."],
          ].map(([t, d], i) => (
            <li key={t} className="card p-6">
              <span className="font-display text-4xl text-blush-deep">0{i + 1}</span>
              <h3 className="mt-3 font-sans text-base font-semibold">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Delivery areas */}
      <section className="container-page mt-24" aria-label="Yetkazib berish hududlari">
        <div className="card overflow-hidden lg:grid lg:grid-cols-[1fr_1.4fr]">
          <div className="bg-forest p-8 text-ivory sm:p-10">
            <p className="eyebrow mb-3 text-ivory/70">Yetkazib berish</p>
            <h2 className="text-4xl">Qayerga yetkazamiz?</h2>
            <p className="mt-4 text-ivory/80">
              Hozirda faqat quyidagi hududlarga yetkazib beramiz. Narx buyurtma rasmiylashtirilishidan oldin ko‘rsatiladi.
            </p>
            <Link href="/yetkazib-berish" className="btn-light mt-6">
              Batafsil
            </Link>
          </div>
          <div className="divide-y divide-line p-6 sm:p-10">
            {delivery.regions.length === 0 ? (
              <p className="text-muted">Yetkazib berish hududlari hali sozlanmagan.</p>
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
                      <p className="font-semibold text-forest">{formatUZS(z.fee)}</p>
                      {z.freeFrom ? <p className="text-muted">{formatUZS(z.freeFrom)}dan bepul</p> : null}
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
          <h2 className="mt-3 text-4xl">Bizni Instagram’da kuzating</h2>
          <a href={store.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-6">
            Instagram sahifamiz
          </a>
        </section>
      ) : null}

      {/* Newsletter & support */}
      <section className="container-page mt-24" aria-label="Obuna">
        <div className="grid gap-10 rounded-[2rem] bg-forest-deep px-6 py-12 text-ivory sm:px-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-4xl">Bayramlarni o‘tkazib yubormang</h2>
            <p className="mt-3 text-ivory/75">Mavsumiy kolleksiyalar va bayram oldidan eslatmalar haqida xabar beramiz. Faqat roziligingiz bilan.</p>
            {tg ? (
              <a href={tg} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blush hover:underline">
                <TelegramIcon size={18} /> Savolingiz bormi? Telegram orqali yozing
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
