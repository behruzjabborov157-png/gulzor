import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { RetryPayment } from "@/components/store/retry-payment";
import { Alert, ProductImage } from "@/components/ui/primitives";
import { fmt, localePath, pick, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { getLocale } from "@/i18n/server";
import { getCustomer } from "@/lib/auth";
import { formatDateISO, formatDateTime, formatPhone, formatUZS } from "@/lib/format";
import { getOrderWithItems, TRACK_STEPS } from "@/lib/orders";
import { getSettings, telegramLink } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDict(await getLocale()).meta.order, robots: { index: false } };
}

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string; yangi?: string }> };

function tokenMatches(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

type Data = NonNullable<Awaited<ReturnType<typeof getOrderWithItems>>>;

/** Order items, events and delivery area are stored in Uzbek; look up current Russian names when shown in Russian. */
async function russianNames(data: Data) {
  const db = await getDb();
  const productIds = [
    ...new Set(data.items.flatMap((i) => [i.productId, ...i.addons.map((a) => a.productId)]).filter((x): x is number => x != null)),
  ];
  const variantIds = data.items.map((i) => i.variantId).filter((x): x is number => x != null);
  const [products, variants, zones, regions] = await Promise.all([
    productIds.length ? db
          .select({ id: schema.products.id, nameRu: schema.products.nameRu, colorOptions: schema.products.colorOptions, colorOptionsRu: schema.products.colorOptionsRu })
          .from(schema.products).where(inArray(schema.products.id, productIds)) : [],
    variantIds.length
      ? db.select({ id: schema.productVariants.id, nameRu: schema.productVariants.nameRu }).from(schema.productVariants).where(inArray(schema.productVariants.id, variantIds))
      : [],
    data.order.zoneId ? db.select({ id: schema.deliveryZones.id, nameRu: schema.deliveryZones.nameRu }).from(schema.deliveryZones).where(inArray(schema.deliveryZones.id, [data.order.zoneId])) : [],
    data.order.regionId
      ? db.select({ id: schema.deliveryRegions.id, nameRu: schema.deliveryRegions.nameRu }).from(schema.deliveryRegions).where(inArray(schema.deliveryRegions.id, [data.order.regionId]))
      : [],
  ]);
  const map = (rows: { id: number; nameRu: string | null }[]) => new Map(rows.map((r) => [r.id, r.nameRu]));
  const colors = new Map(products.map((p) => [p.id, (c: string) => p.colorOptionsRu[p.colorOptions.indexOf(c)] || c]));
  return { product: map(products), variant: map(variants), color: colors, zone: zones[0]?.nameRu ?? null, region: regions[0]?.nameRu ?? null };
}

function eventText(locale: Locale, e: Data["events"][number]): string {
  const t = getDict(locale).order;
  const p = (e.params ?? {}) as Record<string, string | number>;
  if (e.code === "status" && e.toStatus && e.toStatus in t.statuses) {
    const status = t.statuses[e.toStatus as keyof typeof t.statuses];
    return p.reason ? fmt(t.events.statusReason, { status, reason: p.reason }) : fmt(t.events.status, { status });
  }
  if (e.code === "payment_paid") return fmt(t.events.payment_paid, { provider: p.provider ?? "", amount: formatUZS(Number(p.amount ?? 0), locale) });
  if (e.code && e.code in t.events) return fmt(t.events[e.code as keyof typeof t.events], p);
  return e.message; // older events without a code
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { number } = await params;
  const { t: token, yangi } = await searchParams;
  const locale = await getLocale();
  const data = await getOrderWithItems({ number: decodeURIComponent(number) });
  if (!data) notFound();
  const { order: o, items, events } = data;

  // Access: the secret link from the confirmation, or the signed-in owner. Otherwise behave as not found.
  const customer = await getCustomer();
  const allowed = (token && tokenMatches(token, o.accessToken)) || (customer && o.customerId === customer.id);
  if (!allowed) notFound();

  const dict = getDict(locale);
  const t = dict.order;
  const uzs = (n: number) => formatUZS(n, locale);
  const ru = locale === "ru" ? await russianNames(data) : null;
  const productName = (id: number | null, stored: string) => (ru && id != null ? pick(locale, stored, ru.product.get(id)) : stored);
  const variantName = (id: number | null, stored: string | null) => (ru && id != null && stored ? pick(locale, stored, ru.variant.get(id)) : stored);

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
  const area = [ru?.region || o.regionName, ru?.zone || o.zoneName, o.district, o.neighborhood, o.address, o.apartment && fmt(t.apartment, { n: o.apartment })];

  return (
    <div className="container-page max-w-4xl pt-10">
      {isFresh && !closed ? (
        <div className="mb-10 text-center">
          {/* Success mark: the circle pops in, the tick draws itself and petals scatter (static with reduced motion). */}
          <div className="relative mx-auto mb-6 h-20 w-20" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span
                key={i}
                className="petal-burst absolute top-1/2 left-1/2 h-3 w-2 rounded-full"
                style={{ "--a": `${i * 45}deg`, background: i % 2 ? "var(--color-fuchsia)" : "var(--color-coral)" } as React.CSSProperties}
              />
            ))}
            <svg viewBox="0 0 80 80" className="animate-pop-in relative h-20 w-20">
              <circle cx="40" cy="40" r="38" fill="var(--color-wine)" />
              <path d="M25 41 l10 10 l20 -22" fill="none" stroke="var(--color-ivory)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="animate-draw" />
            </svg>
          </div>
          <h1 className="animate-fade-up text-4xl text-plum sm:text-5xl">{t.receivedTitle}</h1>
          <p className="mt-3 text-muted">
            {t.numberLabel} <strong className="text-charcoal">{o.number}</strong>. {t.saveLink}
          </p>
        </div>
      ) : (
        <h1 className="mb-8 text-4xl">{fmt(t.title, { number: o.number })}</h1>
      )}

      {online && o.paymentStatus === "pending" && !closed ? (
        <div className="mb-6">
          <Alert tone="warning">
            <p>{fmt(t.paymentPending, { provider: t.paymentMethod[o.paymentMethod] })}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <RetryPayment number={o.number} token={token ?? ""} />
              <Link href={localePath(locale, `/buyurtma/${o.number}?t=${token ?? ""}`)} className="btn-secondary btn-sm">
                {t.refresh}
              </Link>
            </div>
          </Alert>
        </div>
      ) : null}

      <section className="card p-6 sm:p-8" aria-label={t.statusAria}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-semibold">{fmt(t.status, { status: t.statuses[o.status] })}</p>
          <span className={`badge ${o.paymentStatus === "paid" ? "bg-sage-light text-wine" : "bg-petal text-charcoal"}`}>
            {t.paymentMethod[o.paymentMethod]} · {t.paymentStatus[o.paymentStatus]}
          </span>
        </div>
        {closed ? (
          <p className="mt-4 text-danger">
            {o.status === "rejected" ? t.closedRejected : t.closedCancelled}
            {o.cancelReason ? ` ${fmt(t.reason, { reason: o.cancelReason })}` : ""}
          </p>
        ) : (
          <ol className="mt-6 grid grid-cols-5 gap-1" aria-label={t.steps}>
            {TRACK_STEPS.map((s, i) => (
              <li key={s.status} className="flex flex-col items-center text-center" aria-current={i === stepIndex ? "step" : undefined}>
                <span className={`h-1.5 w-full rounded-full ${i <= stepIndex ? "bg-wine" : "bg-line"}`} />
                <span className={`mt-2 text-[11px] sm:text-xs ${i <= stepIndex ? "font-semibold text-wine" : "text-muted"}`}>
                  {t.trackSteps[s.status as keyof typeof t.trackSteps]}
                </span>
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
                  <span>{eventText(locale, e)}</span>
                </li>
              ))}
          </ul>
        ) : null}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="card p-6" aria-label={o.fulfillment === "pickup" ? t.pickup : t.delivery}>
          <h2 className="mb-3 text-2xl">{o.fulfillment === "pickup" ? t.pickup : t.delivery}</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted">{t.dateTime}</dt>
              <dd>
                {formatDateISO(o.deliveryDate, true, locale)}, {o.slotLabel}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{o.fulfillment === "pickup" ? t.address : t.deliveryAddress}</dt>
              <dd>{area.filter(Boolean).join(", ")}</dd>
            </div>
            <div>
              <dt className="text-muted">{t.recipient}</dt>
              <dd>
                {o.recipientName}, {formatPhone(o.recipientPhone)}
              </dd>
            </div>
            {o.cardMessage ? (
              <div>
                <dt className="text-muted">{t.card}</dt>
                <dd className="italic">“{o.cardMessage}”</dd>
              </div>
            ) : null}
          </dl>
        </section>
        <section className="card p-6" aria-label={t.items}>
          <h2 className="mb-3 text-2xl">{t.items}</h2>
          <ul className="space-y-3">
            {items.map((i) => {
              const name = productName(i.productId, i.productName);
              return (
                <li key={i.id} className="flex gap-3 text-sm">
                  <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-cream">
                    <ProductImage src={i.imageUrl} alt={name} sizes="48px" locale={locale} />
                  </div>
                  <div className="flex-1">
                    <p>
                      {name} × {i.quantity}
                    </p>
                    <p className="text-muted">
                      {[
                        variantName(i.variantId, i.variantName),
                        i.stems ? fmt(dict.common.pieces, { n: i.stems }) : null,
                        i.color && ru && i.productId != null ? (ru.color.get(i.productId)?.(i.color) ?? i.color) : i.color,
                        ...i.addons.map((a) => `+ ${productName(a.productId, a.name)}`),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <p className="font-semibold">{uzs(i.lineTotal)}</p>
                </li>
              );
            })}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{t.products}</dt>
              <dd>{uzs(o.subtotal)}</dd>
            </div>
            {o.discount ? (
              <div className="flex justify-between text-success">
                <dt>{t.discount}</dt>
                <dd>−{uzs(o.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted">{t.deliveryFee}</dt>
              <dd>{uzs(o.deliveryFee)}</dd>
            </div>
            {o.serviceFee ? (
              <div className="flex justify-between">
                <dt className="text-muted">{t.serviceFee}</dt>
                <dd>{uzs(o.serviceFee)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between pt-1 text-base font-semibold">
              <dt>{t.total}</dt>
              <dd>{uzs(o.total)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {tg ? (
          <a href={tg} target="_blank" rel="noopener noreferrer" className="btn-primary">
            {t.telegram}
          </a>
        ) : store.phone ? (
          <a href={`tel:${store.phone}`} className="btn-primary">
            {t.call}
          </a>
        ) : null}
        <Link href={localePath(locale, "/katalog")} className="btn-secondary">
          {t.continue}
        </Link>
      </div>
    </div>
  );
}
