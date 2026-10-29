import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/primitives";
import { fmt, localePath, pick } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";
import { getDeliveryConfig } from "@/lib/delivery";
import { formatPhone, formatUZS } from "@/lib/format";
import { availablePaymentMethods } from "@/lib/payments/config";
import { getSettings, telegramLink } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDict(locale).meta;
  return { title: t.deliveryTitle, description: t.deliveryDescription, alternates: alternates(locale, "/yetkazib-berish") };
}

export default async function DeliveryPage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const t = dict.delivery;
  const uzs = (n: number) => formatUZS(n, locale);
  const [{ regions, slots }, { checkout, store }] = await Promise.all([getDeliveryConfig(locale), getSettings()]);
  const payments = availablePaymentMethods(checkout, locale);
  const tg = telegramLink(store.telegramUsername);
  const pickupAddress = pick(locale, checkout.pickupAddress, checkout.pickupAddressRu);

  return (
    <div className="container-page max-w-4xl pt-8">
      <Breadcrumbs label={dict.common.breadcrumbs} items={[{ href: localePath(locale, "/"), label: dict.common.home }, { label: dict.layout.nav.delivery }]} />
      <h1 className="text-4xl sm:text-5xl">{t.title}</h1>
      <p className="mt-4 text-lg text-muted">{t.intro}</p>

      <section className="mt-10" aria-labelledby="zones-h">
        <h2 id="zones-h" className="mb-4 text-3xl">
          {t.zones}
        </h2>
        {regions.length === 0 ? (
          <p className="text-muted">{t.none}</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line bg-cream text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    {t.colZone}
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    {t.colFee}
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    {t.colFree}
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    {t.colMin}
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    {t.colSameDay}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {regions.flatMap((r) =>
                  r.zones.map((z) => (
                    <tr key={z.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold">
                          {r.name} — {z.name}
                        </p>
                        {z.description ? <p className="mt-0.5 text-xs text-muted">{z.description}</p> : null}
                      </td>
                      <td className="px-5 py-4">{uzs(z.fee)}</td>
                      <td className="px-5 py-4">{z.freeFrom ? fmt(t.freeFrom, { amount: uzs(z.freeFrom) }) : "—"}</td>
                      <td className="px-5 py-4">{z.minOrder ? uzs(z.minOrder) : "—"}</td>
                      <td className="px-5 py-4">{z.sameDayEnabled ? fmt(t.sameDayUntil, { time: z.sameDayCutoff }) : t.no}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm text-muted">{t.sameDayNote}</p>
      </section>

      {slots.length ? (
        <section className="mt-10" aria-labelledby="slots-h">
          <h2 id="slots-h" className="mb-4 text-3xl">
            {t.slots}
          </h2>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <span key={s.id} className="chip">
                {s.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {checkout.pickupEnabled ? (
        <section className="mt-10">
          <h2 className="mb-2 text-3xl">{t.pickup}</h2>
          <p>{fmt(t.pickupText, { address: pickupAddress || t.pickupSoon })}</p>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="pay-h">
        <h2 id="pay-h" className="mb-4 text-3xl">
          {t.payment}
        </h2>
        {payments.length ? (
          <ul className="space-y-2">
            {payments.map((p) => (
              <li key={p.id} className="card px-5 py-4">
                <p className="font-semibold">{p.label}</p>
                <p className="text-sm text-muted">{p.hint}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t.noPayments}</p>
        )}
      </section>

      <section className="card mt-10 bg-petal/30 p-6" aria-labelledby="other-h">
        <h2 id="other-h" className="text-2xl">
          {t.otherTitle}
        </h2>
        <p className="mt-2 text-muted">{t.otherText}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {tg ? (
            <a href={tg} target="_blank" rel="noopener noreferrer" className="btn-primary">
              {t.telegram}
            </a>
          ) : null}
          {store.phone ? (
            <a href={`tel:${store.phone}`} className="btn-secondary">
              {formatPhone(store.phone)}
            </a>
          ) : null}
          {!tg && !store.phone ? (
            <Link href={localePath(locale, "/maxsus-guldasta")} className="btn-primary">
              {t.request}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
