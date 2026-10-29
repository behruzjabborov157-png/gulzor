import { notFound } from "next/navigation";
import { RevealObserver } from "@/components/motion";
import { CartDrawer } from "@/components/store/cart-drawer";
import { FavoritesSync } from "@/components/store/client-widgets";
import { DemoBanner, Footer, Header } from "@/components/store/layout-parts";
import { LocaleProvider } from "@/i18n/client";
import { isLocale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { getCustomer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

// Prices, stock and delivery rules come from the database on every request.
export const dynamic = "force-dynamic";

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [{ store, checkout }, customer] = await Promise.all([getSettings(), getCustomer()]);
  return (
    <LocaleProvider locale={lang}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-wine focus:px-4 focus:py-2 focus:text-ivory">
        {getDict(lang).layout.skipToContent}
      </a>
      {checkout.demoMode ? <DemoBanner locale={lang} /> : null}
      <Header customerName={customer?.name ?? null} locale={lang} />
      <main id="main">{children}</main>
      <Footer store={store} locale={lang} />
      <FavoritesSync loggedIn={!!customer} />
      <CartDrawer />
      <RevealObserver />
    </LocaleProvider>
  );
}
