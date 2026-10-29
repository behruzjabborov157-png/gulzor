import { InstallApp } from "@/components/pwa";
import Link from "next/link";
import { Suspense } from "react";
import { InstagramIcon, PhoneIcon, TelegramIcon, UserIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/primitives";
import { fmt, localePath, pick, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { formatPhone } from "@/lib/format";
import { telegramLink, type StoreSettings } from "@/lib/settings";
import { CartLink, FavoritesLink, LanguageSwitch, MobileNav, SearchBox, SearchToggle, type NavItem } from "./client-widgets";

function navItems(locale: Locale): NavItem[] {
  const n = getDict(locale).layout.nav;
  const items: [string, string][] = [
    ["/", n.home],
    ["/katalog", n.all],
    ["/katalog/guldastalar", n.bouquets],
    ["/katalog/atirgullar", n.roses],
    ["/katalog/lolalar", n.tulips],
    ["/katalog/qutidagi-gullar", n.boxes],
    ["/katalog/savatdagi-gullar", n.baskets],
    ["/katalog/xona-osimliklari", n.plants],
    ["/katalog/sovgalar", n.gifts],
    ["/yetkazib-berish", n.delivery],
  ];
  return items.map(([href, label]) => ({ href: localePath(locale, href), label }));
}

export function DemoBanner({ locale }: { locale: Locale }) {
  return <div className="bg-wine px-4 py-2 text-center text-xs text-ivory/90">{getDict(locale).layout.demoBanner}</div>;
}

export function Header({ customerName, locale }: { customerName: string | null; locale: Locale }) {
  const t = getDict(locale).layout;
  const nav = navItems(locale);
  const extra: NavItem[] = [
    { href: localePath(locale, "/maxsus-guldasta"), label: t.extra.custom },
    { href: localePath(locale, "/kuzatish"), label: t.extra.track },
    { href: localePath(locale, "/sevimlilar"), label: t.extra.favorites },
    { href: localePath(locale, "/hisob"), label: t.extra.account },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/85">
      <div className="container-page relative flex h-16 items-center gap-3 lg:h-20">
        <MobileNav items={nav} extra={extra} />
        <Link href={localePath(locale, "/")} aria-label={t.logoHome} className="shrink-0">
          <Logo />
        </Link>
        <div className="mx-auto hidden w-full max-w-md lg:block">
          <SearchBox />
        </div>
        <div className="ml-auto flex items-center gap-0.5 lg:ml-0">
          <SearchToggle />
          <Suspense>
            <LanguageSwitch />
          </Suspense>
          <Link
            href={localePath(locale, "/hisob")}
            className="hidden h-10 items-center gap-2 rounded-full px-2 text-sm hover:bg-wine/5 sm:flex"
            aria-label={customerName ? fmt(t.accountOf, { name: customerName }) : t.signInOrRegister}
          >
            <UserIcon size={21} />
            <span className="hidden xl:inline">{customerName ? customerName.split(" ")[0] : t.signIn}</span>
          </Link>
          <FavoritesLink />
          <CartLink />
        </div>
      </div>
      <nav aria-label={t.categoriesNav} className="hidden border-t border-line/70 lg:block">
        <ul className="container-page flex h-11 items-center justify-between gap-4 text-[13px] font-medium text-charcoal/85">
          {nav.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className="py-3 transition hover:text-wine">
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export function Footer({ store, locale }: { store: StoreSettings; locale: Locale }) {
  const t = getDict(locale).layout.footer;
  const tg = telegramLink(store.telegramUsername);
  const lp = (p: string) => localePath(locale, p);
  const address = pick(locale, store.address, store.addressRu);
  const hours = pick(locale, store.workingHours, store.workingHoursRu);
  return (
    <footer className="mt-24 bg-plum text-ivory/85">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ivory/70">{t.tagline}</p>
          <InstallApp />
          <div className="mt-5 flex gap-2">
            {tg ? (
              <a href={tg} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-ivory/10 hover:bg-ivory/20" aria-label="Telegram">
                <TelegramIcon />
              </a>
            ) : null}
            {store.instagramUrl ? (
              <a href={store.instagramUrl} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-ivory/10 hover:bg-ivory/20" aria-label="Instagram">
                <InstagramIcon />
              </a>
            ) : null}
          </div>
        </div>
        <div>
          <h2 className="mb-4 font-sans text-sm font-semibold tracking-wider text-ivory uppercase">{t.catalog}</h2>
          <ul className="space-y-2.5 text-sm">
            {navItems(locale)
              .slice(1, 9)
              .map((it) => (
                <li key={it.href}>
                  <Link href={it.href} className="hover:text-ivory">
                    {it.label}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-4 font-sans text-sm font-semibold tracking-wider text-ivory uppercase">{t.customers}</h2>
          <ul className="space-y-2.5 text-sm">
            <li><Link href={lp("/yetkazib-berish")} className="hover:text-ivory">{t.deliveryPayment}</Link></li>
            <li><Link href={lp("/kuzatish")} className="hover:text-ivory">{t.track}</Link></li>
            <li><Link href={lp("/maxsus-guldasta")} className="hover:text-ivory">{t.custom}</Link></li>
            <li><Link href={lp("/oferta")} className="hover:text-ivory">{t.offer}</Link></li>
            <li><Link href={lp("/maxfiylik")} className="hover:text-ivory">{t.privacy}</Link></li>
            <li><Link href={lp("/rasm-mualliflari")} className="hover:text-ivory">{t.credits}</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-4 font-sans text-sm font-semibold tracking-wider text-ivory uppercase">{t.contact}</h2>
          <ul className="space-y-3 text-sm">
            {store.phone ? (
              <li>
                <a href={`tel:${store.phone}`} className="inline-flex items-center gap-2 hover:text-ivory">
                  <PhoneIcon size={16} /> {formatPhone(store.phone)}
                </a>
              </li>
            ) : null}
            {tg ? (
              <li>
                <a href={tg} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-ivory">
                  <TelegramIcon size={16} /> @{store.telegramUsername.replace(/^@/, "")}
                </a>
              </li>
            ) : null}
            {address ? <li>{address}</li> : null}
            {hours ? <li>{hours}</li> : null}
            {!store.phone && !tg ? <li className="text-ivory/60">{t.contactSoon}</li> : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-ivory/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-ivory/55 sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} {store.legalName || "Gulzor"}. {t.rights}
          </p>
          <p>{t.currency}</p>
        </div>
      </div>
    </footer>
  );
}
