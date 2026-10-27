"use client";

import Link from "next/link";
import { useState } from "react";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Alert, EmptyState, ProductImage } from "@/components/ui/primitives";
import { formatUZS } from "@/lib/format";
import { MAX_LINE_QUANTITY } from "@/lib/pricing";
import type { Quote } from "@/lib/quote";
import { cartStore, removeLine, toServerLines, updateQuantity } from "./cart";
import { prefsStore, useQuote } from "./use-quote";

export type ZoneOption = { id: number; label: string; fee: number; freeFrom: number | null; minOrder: number | null };

export function Summary({ quote, loading, showDeliveryHint }: { quote: Quote | null; loading: boolean; showDeliveryHint?: boolean }) {
  if (!quote) return <div className="h-40 animate-pulse rounded-2xl bg-ivory-deep" aria-label="Hisoblanmoqda" />;
  return (
    <dl className={`space-y-2.5 text-sm transition-opacity ${loading ? "opacity-60" : ""}`} aria-live="polite">
      <div className="flex justify-between">
        <dt className="text-muted">Mahsulotlar</dt>
        <dd>{formatUZS(quote.subtotal)}</dd>
      </div>
      {quote.discount > 0 ? (
        <div className="flex justify-between text-success">
          <dt>Chegirma{quote.coupon ? ` (${quote.coupon.code})` : ""}</dt>
          <dd>−{formatUZS(quote.discount)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between">
        <dt className="text-muted">Yetkazib berish</dt>
        <dd>
          {quote.zone ? (quote.deliveryFee === 0 ? "Bepul" : formatUZS(quote.deliveryFee)) : showDeliveryHint ? <span className="text-muted">hududni tanlang</span> : formatUZS(0)}
        </dd>
      </div>
      {quote.serviceFee > 0 ? (
        <div className="flex justify-between">
          <dt className="text-muted">{quote.serviceFeeLabel}</dt>
          <dd>{formatUZS(quote.serviceFee)}</dd>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <dt className="font-semibold">Jami</dt>
        <dd className="font-display text-2xl text-forest">{formatUZS(quote.total)}</dd>
      </div>
      {quote.zone?.freeFrom && quote.deliveryFee > 0 ? (
        <p className="text-xs text-muted">
          Yana {formatUZS(quote.zone.freeFrom - (quote.subtotal - quote.discount))} lik xarid qilsangiz, yetkazib berish bepul.
        </p>
      ) : null}
    </dl>
  );
}

export function CartView({ zones }: { zones: ZoneOption[] }) {
  const [lines, , hydrated] = cartStore.useStore();
  const [prefs, setPrefs, prefsReady] = prefsStore.useStore();
  const [couponInput, setCouponInput] = useState("");
  const zoneId = prefs.zoneId && zones.some((z) => z.id === prefs.zoneId) ? prefs.zoneId : null;

  const { quote, error, loading } = useQuote(
    hydrated && prefsReady && lines.length
      ? { lines: toServerLines(lines), couponCode: prefs.couponCode || null, fulfillment: zoneId ? "delivery" : undefined, zoneId }
      : null,
  );

  if (!hydrated) return <div className="h-64 animate-pulse rounded-2xl bg-ivory-deep" />;
  if (lines.length === 0) {
    return (
      <EmptyState
        title="Savatingiz bo‘sh"
        text="Katalogdan guldasta tanlang — biz uni mehr bilan yig‘ib, siz tanlagan vaqtda yetkazamiz."
        action={<Link href="/katalog" className="btn-primary">Gullarni tanlash</Link>}
      />
    );
  }

  const qLine = (i: number) => quote?.lines[i];
  const blocking = !quote || quote.errors.length > 0 || loading;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <ul className="divide-y divide-line border-y border-line" aria-label="Savatdagi mahsulotlar">
        {lines.map((l, i) => {
          const ql = qLine(i);
          const price = ql && !ql.error ? ql.lineTotal : l.unitPrice * l.quantity;
          const changed = ql && !ql.error && ql.unitPrice !== l.unitPrice;
          return (
            <li key={l.key} className="flex gap-4 py-6">
              <Link href={`/gul/${l.slug}`} className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-ivory-deep sm:h-32 sm:w-28">
                <ProductImage src={l.image} alt={l.name} sizes="112px" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/gul/${l.slug}`} className="font-medium hover:text-forest">
                      {l.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted">
                      {[l.variantName, l.stems ? `${l.stems} dona` : null, l.color].filter(Boolean).join(" · ")}
                    </p>
                    {l.addons.length ? (
                      <p className="mt-0.5 text-sm text-muted">+ {l.addons.map((a) => a.name).join(", ")}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 font-semibold">{formatUZS(price)}</p>
                </div>
                {ql?.error ? (
                  <p className="mt-2 text-sm text-danger" role="alert">
                    {ql.error}.{" "}
                    <Link href={`/gul/${l.slug}`} className="underline">O‘xshash guldastalar</Link>
                  </p>
                ) : null}
                {changed ? <p className="mt-2 text-xs text-muted">Narx yangilandi: {formatUZS(ql!.unitPrice)} / dona</p> : null}
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
                  <div className="flex items-center rounded-full border border-line bg-white">
                    <button type="button" onClick={() => updateQuantity(l.key, l.quantity - 1)} disabled={l.quantity <= 1} className="flex h-9 w-9 items-center justify-center disabled:opacity-30" aria-label={`${l.name}: kamaytirish`}>
                      <MinusIcon size={15} />
                    </button>
                    <span className="w-8 text-center text-sm" aria-live="polite" aria-label={`Miqdor ${l.quantity}`}>{l.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(l.key, l.quantity + 1)} disabled={l.quantity >= MAX_LINE_QUANTITY} className="flex h-9 w-9 items-center justify-center disabled:opacity-30" aria-label={`${l.name}: ko‘paytirish`}>
                      <PlusIcon size={15} />
                    </button>
                  </div>
                  <Link href={`/gul/${l.slug}?tahrir=${encodeURIComponent(l.key)}`} className="text-sm text-forest underline-offset-4 hover:underline">
                    O‘zgartirish
                  </Link>
                  <button type="button" onClick={() => removeLine(l.key)} className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger">
                    <TrashIcon size={16} /> O‘chirish
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="lg:sticky lg:top-36 lg:self-start">
        <div className="card space-y-6 p-6">
          <h2 className="text-2xl">Buyurtma</h2>

          <div>
            <label htmlFor="zone" className="label">Yetkazib berish hududi</label>
            <select id="zone" className="field py-2.5" value={zoneId ?? ""} onChange={(e) => setPrefs((p) => ({ ...p, zoneId: e.target.value ? Number(e.target.value) : null }))}>
              <option value="">Tanlang…</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label} — {formatUZS(z.fee)}
                </option>
              ))}
            </select>
            {zones.length === 0 ? <p className="mt-1.5 text-xs text-muted">Yetkazib berish hududlari hali sozlanmagan.</p> : null}
            <p className="mt-1.5 text-xs text-muted">
              Hududingiz ro‘yxatda yo‘qmi? <Link href="/yetkazib-berish" className="underline">Biz bilan bog‘laning</Link>.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPrefs((p) => ({ ...p, couponCode: couponInput.trim().toUpperCase() }));
            }}
          >
            <label htmlFor="coupon" className="label">Promokod</label>
            {prefs.couponCode ? (
              <div className="flex items-center justify-between rounded-xl border border-line bg-ivory px-4 py-2.5 text-sm">
                <span>
                  <strong>{prefs.couponCode}</strong>
                  {quote?.coupon ? <span className={`ml-2 ${quote.coupon.applied ? "text-success" : "text-danger"}`}>{quote.coupon.message}</span> : null}
                </span>
                <button type="button" onClick={() => setPrefs((p) => ({ ...p, couponCode: "" }))} className="text-muted hover:text-danger" aria-label="Promokodni olib tashlash">
                  ×
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input id="coupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} className="field py-2.5 uppercase" maxLength={40} autoComplete="off" />
                <button className="btn-secondary btn-sm shrink-0" disabled={!couponInput.trim()}>Qo‘llash</button>
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
              {loading ? "Hisoblanmoqda…" : "Rasmiylashtirish"}
            </button>
          ) : (
            <Link href="/buyurtma" className="btn-primary w-full py-4">
              Rasmiylashtirish
            </Link>
          )}
          <p className="text-center text-xs text-muted">Narxlar server tomonidan qayta tekshiriladi.</p>
        </div>
      </aside>
    </div>
  );
}
