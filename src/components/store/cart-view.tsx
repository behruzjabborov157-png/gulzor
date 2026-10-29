"use client";

import Link from "next/link";
import { useState } from "react";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Alert, EmptyState, ProductImage } from "@/components/ui/primitives";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { formatUZS } from "@/lib/format";
import { MAX_LINE_QUANTITY } from "@/lib/pricing";
import type { Quote } from "@/lib/quote";
import { cartFlorist, cartStore, removeLine, toServerLines, updateQuantity } from "./cart";
import { prefsStore, useQuote } from "./use-quote";

export type ZoneOption = { id: number; floristId: number; label: string; fee: number; freeFrom: number | null; minOrder: number | null };

export function Summary({ quote, loading, showDeliveryHint }: { quote: Quote | null; loading: boolean; showDeliveryHint?: boolean }) {
  const { locale, t: dict } = useT();
  const t = dict.cart;
  const uzs = (n: number) => formatUZS(n, locale);
  if (!quote) return <div className="h-40 animate-pulse rounded-2xl bg-cream" aria-label={t.calculating} />;
  return (
    <dl className={`space-y-2.5 text-sm transition-opacity ${loading ? "opacity-60" : ""}`} aria-live="polite">
      <div className="flex justify-between">
        <dt className="text-muted">{t.products}</dt>
        <dd>{uzs(quote.subtotal)}</dd>
      </div>
      {quote.discount > 0 ? (
        <div className="flex justify-between text-success">
          <dt>
            {t.discount}
            {quote.coupon ? ` (${quote.coupon.code})` : ""}
          </dt>
          <dd>−{uzs(quote.discount)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between">
        <dt className="text-muted">{t.delivery}</dt>
        <dd>
          {quote.zone ? (
            quote.deliveryFee === 0 ? (
              t.free
            ) : (
              uzs(quote.deliveryFee)
            )
          ) : showDeliveryHint ? (
            <span className="text-muted">{t.pickZone}</span>
          ) : (
            uzs(0)
          )}
        </dd>
      </div>
      {quote.serviceFee > 0 ? (
        <div className="flex justify-between">
          <dt className="text-muted">{quote.serviceFeeLabel}</dt>
          <dd>{uzs(quote.serviceFee)}</dd>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <dt className="font-semibold">{t.total}</dt>
        <dd className="font-display text-2xl text-wine">{uzs(quote.total)}</dd>
      </div>
      {quote.zone?.freeFrom && quote.deliveryFee > 0 ? (
        <p className="text-xs text-muted">{fmt(t.freeDeliveryLeft, { amount: uzs(quote.zone.freeFrom - (quote.subtotal - quote.discount)) })}</p>
      ) : null}
    </dl>
  );
}

export function CartView({ zones: allZones }: { zones: ZoneOption[] }) {
  const [lines, , hydrated] = cartStore.useStore();
  // Each shop delivers itself: only the cart's shop's zones (older carts that don't know their shop see all; the server checks).
  const shop = cartFlorist(lines);
  const zones = shop ? allZones.filter((z) => z.floristId === shop.id) : allZones;
  const [prefs, setPrefs, prefsReady] = prefsStore.useStore();
  const [couponInput, setCouponInput] = useState("");
  const { locale, t: dict, href } = useT();
  const t = dict.cart;
  const uzs = (n: number) => formatUZS(n, locale);
  const zoneId = prefs.zoneId && zones.some((z) => z.id === prefs.zoneId) ? prefs.zoneId : null;

  const { quote, error, loading } = useQuote(
    hydrated && prefsReady && lines.length
      ? { lines: toServerLines(lines), couponCode: prefs.couponCode || null, fulfillment: zoneId ? "delivery" : undefined, zoneId }
      : null,
  );

  if (!hydrated) return <div className="h-64 animate-pulse rounded-2xl bg-cream" />;
  if (lines.length === 0) {
    return (
      <EmptyState
        title={t.emptyTitle}
        text={t.emptyText}
        action={
          <Link href={href("/katalog")} className="btn-primary">
            {t.choose}
          </Link>
        }
      />
    );
  }

  const qLine = (i: number) => quote?.lines[i];
  const blocking = !quote || quote.errors.length > 0 || loading;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="lg:col-span-2 -mb-4">
        {quote?.florist ? (
          <p className="text-sm text-muted">
            {dict.shop.soldBy}{" "}
            <Link href={href(`/dokon/${quote.florist.slug}`)} className="font-semibold text-wine underline-offset-4 hover:underline">
              {quote.florist.name}
            </Link>
          </p>
        ) : null}
      </div>
      <ul className="divide-y divide-line border-y border-line" aria-label={t.items}>
        {lines.map((l, i) => {
          const ql = qLine(i);
          const ok = ql && !ql.error;
          const price = ok ? ql.lineTotal : l.unitPrice * l.quantity;
          const changed = ok && ql.unitPrice !== l.unitPrice;
          // Names from the latest server quote are in the current language; the stored ones are a fallback.
          const name = ql?.name ?? l.name;
          const variantName = ok ? ql.variantName : l.variantName;
          const color = ok ? ql.colorLabel : l.color;
          const addons = ok ? ql.addons.map((a) => a.name) : l.addons.map((a) => a.name);
          const productHref = href(`/gul/${l.slug}`);
          return (
            <li key={l.key} className="flex gap-4 py-6">
              <Link href={productHref} className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-cream sm:h-32 sm:w-28">
                <ProductImage src={l.image} alt={name} sizes="112px" locale={locale} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={productHref} className="font-medium hover:text-wine">
                      {name}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted">
                      {[variantName, l.stems ? fmt(dict.common.pieces, { n: l.stems }) : null, color].filter(Boolean).join(" · ")}
                    </p>
                    {addons.length ? <p className="mt-0.5 text-sm text-muted">+ {addons.join(", ")}</p> : null}
                  </div>
                  <p className="shrink-0 font-semibold">{uzs(price)}</p>
                </div>
                {ql?.error ? (
                  <p className="mt-2 text-sm text-danger" role="alert">
                    {ql.error}.{" "}
                    <Link href={productHref} className="underline">
                      {t.similar}
                    </Link>
                  </p>
                ) : null}
                {changed ? <p className="mt-2 text-xs text-muted">{fmt(t.priceChanged, { price: uzs(ql.unitPrice) })}</p> : null}
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
                  <div className="flex items-center rounded-full border border-line bg-white">
                    <button
                      type="button"
                      onClick={() => updateQuantity(l.key, l.quantity - 1)}
                      disabled={l.quantity <= 1}
                      className="flex h-9 w-9 items-center justify-center disabled:opacity-30"
                      aria-label={fmt(t.decrease, { name })}
                    >
                      <MinusIcon size={15} />
                    </button>
                    <span className="w-8 text-center text-sm" aria-live="polite" aria-label={fmt(t.quantity, { n: l.quantity })}>
                      {l.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(l.key, l.quantity + 1)}
                      disabled={l.quantity >= MAX_LINE_QUANTITY}
                      className="flex h-9 w-9 items-center justify-center disabled:opacity-30"
                      aria-label={fmt(t.increase, { name })}
                    >
                      <PlusIcon size={15} />
                    </button>
                  </div>
                  <Link href={href(`/gul/${l.slug}?tahrir=${encodeURIComponent(l.key)}`)} className="text-sm text-wine underline-offset-4 hover:underline">
                    {t.edit}
                  </Link>
                  <button type="button" onClick={() => removeLine(l.key)} className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger">
                    <TrashIcon size={16} /> {t.remove}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="lg:sticky lg:top-36 lg:self-start">
        <div className="card space-y-6 p-6">
          <h2 className="text-2xl">{t.order}</h2>

          <div>
            <label htmlFor="zone" className="label">
              {t.zone}
            </label>
            <select id="zone" className="field py-2.5" value={zoneId ?? ""} onChange={(e) => setPrefs((p) => ({ ...p, zoneId: e.target.value ? Number(e.target.value) : null }))}>
              <option value="">{t.select}</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label} — {uzs(z.fee)}
                </option>
              ))}
            </select>
            {zones.length === 0 ? <p className="mt-1.5 text-xs text-muted">{t.noZones}</p> : null}
            <p className="mt-1.5 text-xs text-muted">
              {t.zoneMissing}{" "}
              <Link href={href("/yetkazib-berish")} className="underline">
                {t.contactUs}
              </Link>
              .
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPrefs((p) => ({ ...p, couponCode: couponInput.trim().toUpperCase() }));
            }}
          >
            <label htmlFor="coupon" className="label">
              {t.coupon}
            </label>
            {prefs.couponCode ? (
              <div className="flex items-center justify-between rounded-xl border border-line bg-ivory px-4 py-2.5 text-sm">
                <span>
                  <strong>{prefs.couponCode}</strong>
                  {quote?.coupon ? <span className={`ml-2 ${quote.coupon.applied ? "text-success" : "text-danger"}`}>{quote.coupon.message}</span> : null}
                </span>
                <button type="button" onClick={() => setPrefs((p) => ({ ...p, couponCode: "" }))} className="text-muted hover:text-danger" aria-label={t.removeCoupon}>
                  ×
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input id="coupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} className="field py-2.5 uppercase" maxLength={40} autoComplete="off" />
                <button className="btn-secondary btn-sm shrink-0" disabled={!couponInput.trim()}>
                  {t.apply}
                </button>
              </div>
            )}
          </form>

          <Summary quote={quote} loading={loading} showDeliveryHint />

          {error ? <Alert tone="error">{error}</Alert> : null}
          {quote?.errors.length ? (
            <Alert tone="error">
              <ul className="list-inside list-disc space-y-1">
                {quote.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {blocking ? (
            <button type="button" className="btn-primary w-full py-4" disabled>
              {loading ? t.calculatingShort : t.checkout}
            </button>
          ) : (
            <Link href={href("/buyurtma")} className="btn-primary w-full py-4">
              {t.checkout}
            </Link>
          )}
          <p className="text-center text-xs text-muted">{t.serverCheck}</p>
        </div>
      </aside>
    </div>
  );
}
