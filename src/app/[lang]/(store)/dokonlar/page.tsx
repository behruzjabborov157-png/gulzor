import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckIcon, MapPinIcon } from "@/components/ui/icons";
import { Breadcrumbs, EmptyState } from "@/components/ui/primitives";
import { fmt, localePath } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";
import { listApprovedFlorists } from "@/lib/florists";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDict(locale).shop;
  return { title: t.listTitle, description: t.listIntro, alternates: alternates(locale, "/dokonlar") };
}

/** All approved flower shops on the marketplace. */
export default async function ShopsPage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const t = dict.shop;
  const lp = (p: string) => localePath(locale, p);
  const shops = await listApprovedFlorists(locale);

  return (
    <div className="container-page pt-8">
      <Breadcrumbs label={dict.common.breadcrumbs} items={[{ href: lp("/"), label: dict.common.home }, { label: t.listTitle }]} />
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-5xl">{t.listTitle}</h1>
          <p className="mt-3 text-muted">{t.listIntro}</p>
        </div>
        <Link href="/florist/royxatdan-otish" className="btn-secondary shrink-0">
          {t.openYourShop}
        </Link>
      </header>
      {shops.length === 0 ? (
        <EmptyState title={t.noShops} />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((s) => (
            <li key={s.id}>
              <Link href={lp(`/dokon/${s.slug}`)} className="card group flex h-full gap-4 p-5 transition hover:border-wine/40 hover:shadow-[var(--shadow-soft)]">
                <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-petal font-display text-2xl text-wine">
                  {s.logoUrl ? <Image src={s.logoUrl} alt="" fill sizes="64px" className="object-cover" /> : s.name.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-2xl leading-tight text-plum group-hover:text-wine">{s.name}</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-success">
                    <CheckIcon size={12} /> {t.verified}
                  </span>
                  {s.city ? (
                    <span className="mt-1 flex items-center gap-1 text-sm text-muted">
                      <MapPinIcon size={14} /> {s.city}
                    </span>
                  ) : null}
                  <span className="mt-1 block text-sm text-muted">{fmt(t.products, { n: s.productCount })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
