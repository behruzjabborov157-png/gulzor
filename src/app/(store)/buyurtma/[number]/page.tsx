import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { RetryPayment } from "@/components/store/retry-payment";
import { CheckIcon } from "@/components/ui/icons";
import { Alert, ProductImage } from "@/components/ui/primitives";
import { getCustomer } from "@/lib/auth";
import { formatDateISO, formatDateTime, formatPhone, formatUZS } from "@/lib/format";
import { getOrderWithItems, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, TRACK_STEPS } from "@/lib/orders";
import { getSettings, telegramLink } from "@/lib/settings";

export const metadata: Metadata = { title: "Buyurtma holati", robots: { index: false } };

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string; yangi?: string }> };

function tokenMatches(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { number } = await params;
  const { t, yangi } = await searchParams;
  const data = await getOrderWithItems({ number: decodeURIComponent(number) });
  if (!data) notFound();
  const { order: o, items, events } = data;

  // Access: the secret link from the confirmation, or the signed-in owner. Otherwise behave as not found.
  const customer = await getCustomer();
  const allowed = (t && tokenMatches(t, o.accessToken)) || (customer && o.customerId === customer.id);
  if (!allowed) notFound();

  const { store } = await getSettings();
  const tg = telegramLink(store.telegramUsername);
  const closed = o.status === "cancelled" || o.status === "rejected";
  const stepIndex = Math.max(
    0,
    TRACK_STEPS.findIndex((s) => s.status === (o.status === "ready" ? "preparing" : o.status)),
  );
  // Checkout redirects here with ?yangi=1, so the success header is shown right after ordering.
  const isFresh = yangi === "1";
  const online = o.paymentMethod !== "cash";

  return (
    <div className="container-page max-w-4xl pt-10">
      {isFresh && !closed ? (
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-forest text-ivory">
            <CheckIcon size={32} />
          </div>
          <h1 className="text-4xl sm:text-5xl">Buyurtmangiz qabul qilindi!</h1>
          <p className="mt-3 text-muted">
            Buyurtma raqami: <strong className="text-charcoal">{o.number}</strong>. Ushbu sahifa havolasini saqlab qo‘ying — u orqali holatni kuzatasiz.
          </p>
        </div>
      ) : (
        <h1 className="mb-8 text-4xl">Buyurtma {o.number}</h1>
      )}

      {online && o.paymentStatus === "pending" && !closed ? (
        <div className="mb-6">
          <Alert tone="warning">
            <p>
              To‘lov hali tasdiqlanmagan. Agar to‘lagan bo‘lsangiz, {PAYMENT_METHOD_LABEL[o.paymentMethod]} tasdig‘i kelishi bilan holat avtomatik yangilanadi.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <RetryPayment number={o.number} token={t ?? ""} />
              <Link href={`/buyurtma/${o.number}?t=${t ?? ""}`} className="btn-secondary btn-sm">Holatni yangilash</Link>
            </div>
          </Alert>
        </div>
      ) : null}

      <section className="card p-6 sm:p-8" aria-label="Holat">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-semibold">Holat: {ORDER_STATUS_LABEL[o.status]}</p>
          <span className={`badge ${o.paymentStatus === "paid" ? "bg-sage-light text-forest" : "bg-blush text-charcoal"}`}>
            {PAYMENT_METHOD_LABEL[o.paymentMethod]} · {PAYMENT_STATUS_LABEL[o.paymentStatus]}
          </span>
        </div>
        {closed ? (
          <p className="mt-4 text-danger">Buyurtma {o.status === "rejected" ? "rad etildi" : "bekor qilindi"}.{o.cancelReason ? ` Sabab: ${o.cancelReason}` : ""}</p>
        ) : (
          <ol className="mt-6 grid grid-cols-5 gap-1" aria-label="Buyurtma bosqichlari">
            {TRACK_STEPS.map((s, i) => (
              <li key={s.status} className="flex flex-col items-center text-center" aria-current={i === stepIndex ? "step" : undefined}>
                <span className={`h-1.5 w-full rounded-full ${i <= stepIndex ? "bg-forest" : "bg-line"}`} />
                <span className={`mt-2 text-[11px] sm:text-xs ${i <= stepIndex ? "font-semibold text-forest" : "text-muted"}`}>{s.label}</span>
              </li>
            ))}
          </ol>
        )}
        {events.filter((e) => e.isPublic).length ? (
          <ul className="mt-6 space-y-2 border-t border-line pt-4 text-sm">
            {events
              .filter((e) => e.isPublic)
              .map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-32 shrink-0 text-muted">{formatDateTime(e.createdAt)}</span>
                  <span>{e.message}</span>
                </li>
              ))}
          </ul>
        ) : null}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="card p-6" aria-label="Yetkazib berish">
          <h2 className="mb-3 text-2xl">{o.fulfillment === "pickup" ? "Olib ketish" : "Yetkazib berish"}</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted">Sana va vaqt</dt>
              <dd>{formatDateISO(o.deliveryDate)}, {o.slotLabel}</dd>
            </div>
            <div>
              <dt className="text-muted">{o.fulfillment === "pickup" ? "Manzil" : "Yetkazish manzili"}</dt>
              <dd>{[o.regionName, o.zoneName, o.district, o.neighborhood, o.address, o.apartment && `kv. ${o.apartment}`].filter(Boolean).join(", ")}</dd>
            </div>
            <div>
              <dt className="text-muted">Qabul qiluvchi</dt>
              <dd>{o.recipientName}, {formatPhone(o.recipientPhone)}</dd>
            </div>
            {o.cardMessage ? (
              <div>
                <dt className="text-muted">Otkritka</dt>
                <dd className="italic">“{o.cardMessage}”</dd>
              </div>
            ) : null}
          </dl>
        </section>
        <section className="card p-6" aria-label="Tarkib">
          <h2 className="mb-3 text-2xl">Tarkib</h2>
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.id} className="flex gap-3 text-sm">
                <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-ivory-deep">
                  <ProductImage src={i.imageUrl} alt={i.productName} sizes="48px" />
                </div>
                <div className="flex-1">
                  <p>{i.productName} × {i.quantity}</p>
                  <p className="text-muted">{[i.variantName, i.stems ? `${i.stems} dona` : null, i.color, ...i.addons.map((a) => `+ ${a.name}`)].filter(Boolean).join(" · ")}</p>
                </div>
                <p className="font-semibold">{formatUZS(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Mahsulotlar</dt><dd>{formatUZS(o.subtotal)}</dd></div>
            {o.discount ? <div className="flex justify-between text-success"><dt>Chegirma</dt><dd>−{formatUZS(o.discount)}</dd></div> : null}
            <div className="flex justify-between"><dt className="text-muted">Yetkazib berish</dt><dd>{formatUZS(o.deliveryFee)}</dd></div>
            {o.serviceFee ? <div className="flex justify-between"><dt className="text-muted">Xizmat haqi</dt><dd>{formatUZS(o.serviceFee)}</dd></div> : null}
            <div className="flex justify-between pt-1 text-base font-semibold"><dt>Jami</dt><dd>{formatUZS(o.total)}</dd></div>
          </dl>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {tg ? (
          <a href={tg} target="_blank" rel="noopener noreferrer" className="btn-primary">Telegram orqali yozish</a>
        ) : store.phone ? (
          <a href={`tel:${store.phone}`} className="btn-primary">Qo‘ng‘iroq qilish</a>
        ) : null}
        <Link href="/katalog" className="btn-secondary">Xaridni davom ettirish</Link>
      </div>
    </div>
  );
}
