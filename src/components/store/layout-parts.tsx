import Link from "next/link";
import { InstagramIcon, PhoneIcon, TelegramIcon, UserIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/primitives";
import { formatPhone } from "@/lib/format";
import { telegramLink, type StoreSettings } from "@/lib/settings";
import { CartLink, FavoritesLink, MobileNav, SearchBox, SearchToggle, type NavItem } from "./client-widgets";

export const NAV: NavItem[] = [
  { href: "/", label: "Bosh sahifa" },
  { href: "/katalog", label: "Barcha gullar" },
  { href: "/katalog/guldastalar", label: "Guldastalar" },
  { href: "/katalog/atirgullar", label: "Atirgullar" },
  { href: "/katalog/lolalar", label: "Lolalar" },
  { href: "/katalog/qutidagi-gullar", label: "Qutidagi gullar" },
  { href: "/katalog/savatdagi-gullar", label: "Savatdagi gullar" },
  { href: "/katalog/xona-osimliklari", label: "O‘simliklar" },
  { href: "/katalog/sovgalar", label: "Sovg‘alar" },
  { href: "/yetkazib-berish", label: "Yetkazib berish" },
];

const EXTRA: NavItem[] = [
  { href: "/maxsus-guldasta", label: "Maxsus guldasta buyurtma qilish" },
  { href: "/kuzatish", label: "Buyurtmani kuzatish" },
  { href: "/sevimlilar", label: "Sevimlilar" },
  { href: "/hisob", label: "Shaxsiy kabinet" },
];

export function DemoBanner() {
  return (
    <div className="bg-forest px-4 py-2 text-center text-xs text-ivory/90">
      Sayt namuna (demo) rejimida: mahsulotlar, narxlar va yetkazib berish shartlari namunaviy. Haqiqiy narxlar do‘kon tomonidan tasdiqlanadi.
    </div>
  );
}

export function Header({ customerName }: { customerName: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/85">
      <div className="container-page relative flex h-16 items-center gap-3 lg:h-20">
        <MobileNav items={NAV} extra={EXTRA} />
        <Link href="/" aria-label="Gulzor — bosh sahifa" className="shrink-0">
          <Logo />
        </Link>
        <div className="mx-auto hidden w-full max-w-md lg:block">
          <SearchBox />
        </div>
        <div className="ml-auto flex items-center gap-0.5 lg:ml-0">
          <SearchToggle />
          <Link
            href="/hisob"
            className="hidden h-10 items-center gap-2 rounded-full px-2 text-sm hover:bg-forest/5 sm:flex"
            aria-label={customerName ? `Shaxsiy kabinet: ${customerName}` : "Kirish yoki ro‘yxatdan o‘tish"}
          >
            <UserIcon size={21} />
            <span className="hidden xl:inline">{customerName ? customerName.split(" ")[0] : "Kirish"}</span>
          </Link>
          <FavoritesLink />
          <CartLink />
        </div>
      </div>
      <nav aria-label="Kategoriyalar" className="hidden border-t border-line/70 lg:block">
        <ul className="container-page flex h-11 items-center justify-between gap-4 text-[13px] font-medium text-charcoal/85">
          {NAV.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className="py-3 transition hover:text-forest">
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export function Footer({ store }: { store: StoreSettings }) {
  const tg = telegramLink(store.telegramUsername);
  return (
    <footer className="mt-24 bg-forest-deep text-ivory/85">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ivory/70">
            Har bir munosabat va har bir inson uchun mehr bilan tanlangan guldastalar.
          </p>
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
          <h2 className="mb-4 font-sans text-sm font-semibold tracking-wider text-ivory uppercase">Katalog</h2>
          <ul className="space-y-2.5 text-sm">
            {NAV.slice(1, 9).map((it) => (
              <li key={it.href}>
                <Link href={it.href} className="hover:text-ivory">
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-4 font-sans text-sm font-semibold tracking-wider text-ivory uppercase">Mijozlarga</h2>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/yetkazib-berish" className="hover:text-ivory">Yetkazib berish va to‘lov</Link></li>
            <li><Link href="/kuzatish" className="hover:text-ivory">Buyurtmani kuzatish</Link></li>
            <li><Link href="/maxsus-guldasta" className="hover:text-ivory">Maxsus guldasta</Link></li>
            <li><Link href="/oferta" className="hover:text-ivory">Ommaviy oferta</Link></li>
            <li><Link href="/maxfiylik" className="hover:text-ivory">Maxfiylik siyosati</Link></li>
            <li><Link href="/rasm-mualliflari" className="hover:text-ivory">Rasm mualliflari</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-4 font-sans text-sm font-semibold tracking-wider text-ivory uppercase">Aloqa</h2>
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
            {store.address ? <li>{store.address}</li> : null}
            {store.workingHours ? <li>{store.workingHours}</li> : null}
            {!store.phone && !tg ? <li className="text-ivory/60">Aloqa ma’lumotlari tez orada qo‘shiladi.</li> : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-ivory/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-ivory/55 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {store.legalName || "Gulzor"}. Barcha huquqlar himoyalangan.</p>
          <p>Narxlar O‘zbekiston so‘mida ko‘rsatilgan.</p>
        </div>
      </div>
    </footer>
  );
}
