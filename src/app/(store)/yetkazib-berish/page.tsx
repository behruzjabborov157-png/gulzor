import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/primitives";
import { getDeliveryConfig } from "@/lib/delivery";
import { formatPhone, formatUZS } from "@/lib/format";
import { availablePaymentMethods } from "@/lib/payments/config";
import { getSettings, telegramLink } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Toshkentda gul yetkazib berish — narxlar va shartlar",
  description: "Gul yetkazib berish hududlari, narxlari, vaqt oraliqlari va to‘lov usullari. Yetkazib berish narxi buyurtma rasmiylashtirilishidan oldin ko‘rsatiladi.",
  alternates: { canonical: "/yetkazib-berish" },
};

export default async function DeliveryPage() {
  const [{ regions, slots }, { checkout, store }] = await Promise.all([getDeliveryConfig(), getSettings()]);
  const payments = availablePaymentMethods(checkout);
  const tg = telegramLink(store.telegramUsername);

  return (
    <div className="container-page max-w-4xl pt-8">
      <Breadcrumbs items={[{ href: "/", label: "Bosh sahifa" }, { label: "Yetkazib berish" }]} />
      <h1 className="text-4xl sm:text-5xl">Yetkazib berish va to‘lov</h1>
      <p className="mt-4 text-lg text-muted">
        Biz faqat quyida ko‘rsatilgan hududlarga yetkazib beramiz. Yetkazib berish narxi va mavjud vaqtlar buyurtmani tasdiqlashdan oldin aniq ko‘rsatiladi.
      </p>

      <section className="mt-10" aria-labelledby="zones-h">
        <h2 id="zones-h" className="mb-4 text-3xl">Hududlar va narxlar</h2>
        {regions.length === 0 ? (
          <p className="text-muted">Yetkazib berish hududlari hali sozlanmagan.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line bg-ivory-deep text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Hudud</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Narx</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Bepul</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Minimal buyurtma</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Shu kuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {regions.flatMap((r) =>
                  r.zones.map((z) => (
                    <tr key={z.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold">{r.name} — {z.name}</p>
                        {z.description ? <p className="mt-0.5 text-xs text-muted">{z.description}</p> : null}
                      </td>
                      <td className="px-5 py-4">{formatUZS(z.fee)}</td>
                      <td className="px-5 py-4">{z.freeFrom ? `${formatUZS(z.freeFrom)}dan` : "—"}</td>
                      <td className="px-5 py-4">{z.minOrder ? formatUZS(z.minOrder) : "—"}</td>
                      <td className="px-5 py-4">{z.sameDayEnabled ? `Ha, soat ${z.sameDayCutoff} gacha buyurtma` : "Yo‘q"}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm text-muted">
          Shu kuni yetkazib berish buyurtma vaqti, guldastani tayyorlash muddati va bo‘sh vaqt oraliqlariga bog‘liq. Mavjud bo‘lmasa, rasmiylashtirishda bu vaqtlar tanlab bo‘lmaydigan bo‘ladi.
        </p>
      </section>

      {slots.length ? (
        <section className="mt-10" aria-labelledby="slots-h">
          <h2 id="slots-h" className="mb-4 text-3xl">Vaqt oraliqlari</h2>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <span key={s.id} className="chip">{s.label}</span>
            ))}
          </div>
        </section>
      ) : null}

      {checkout.pickupEnabled ? (
        <section className="mt-10">
          <h2 className="mb-2 text-3xl">Olib ketish</h2>
          <p>Buyurtmani bepul olib ketishingiz mumkin: {checkout.pickupAddress || "manzil tez orada ko‘rsatiladi"}.</p>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="pay-h">
        <h2 id="pay-h" className="mb-4 text-3xl">To‘lov usullari</h2>
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
          <p className="text-muted">To‘lov usullari hali sozlanmagan.</p>
        )}
      </section>

      <section className="card mt-10 bg-blush/30 p-6" aria-labelledby="other-h">
        <h2 id="other-h" className="text-2xl">Hududingiz ro‘yxatda yo‘qmi?</h2>
        <p className="mt-2 text-muted">Boshqa shahar yoki tumanga yetkazib berish imkoniyatini alohida aniqlab beramiz.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {tg ? <a href={tg} target="_blank" rel="noopener noreferrer" className="btn-primary">Telegram orqali yozish</a> : null}
          {store.phone ? <a href={`tel:${store.phone}`} className="btn-secondary">{formatPhone(store.phone)}</a> : null}
          {!tg && !store.phone ? <Link href="/maxsus-guldasta" className="btn-primary">So‘rov qoldirish</Link> : null}
        </div>
      </section>
    </div>
  );
}
