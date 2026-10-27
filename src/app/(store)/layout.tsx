import { FavoritesSync } from "@/components/store/client-widgets";
import { DemoBanner, Footer, Header } from "@/components/store/layout-parts";
import { getCustomer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

// Prices, stock and delivery rules come from the database on every request.
export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [{ store, checkout }, customer] = await Promise.all([getSettings(), getCustomer()]);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-forest focus:px-4 focus:py-2 focus:text-ivory">
        Asosiy tarkibga o‘tish
      </a>
      {checkout.demoMode ? <DemoBanner /> : null}
      <Header customerName={customer?.name ?? null} />
      <main id="main">{children}</main>
      <Footer store={store} />
      <FavoritesSync loggedIn={!!customer} />
    </>
  );
}
