"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckIcon, MinusIcon, PlusIcon } from "@/components/ui/icons";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { priceErrorText } from "@/i18n/dict";
import { formatUZS } from "@/lib/format";
import { MAX_LINE_QUANTITY, priceLine, type AddonPrice, type PricingProduct } from "@/lib/pricing";
import { addToCart, cartStore, replaceLine } from "./cart";

type Addon = AddonPrice & { image: string | null };

/** Smallest valid stem count of at least 11 (a typical gift bouquet), within the allowed range. */
function defaultStems(p: PricingProduct) {
  if (p.pricingMode !== "per_stem") return 0;
  const step = Math.max(1, p.stemStep);
  let n = p.minStems ?? 1;
  while (n < 11 && n + step <= (p.maxStems ?? 101)) n += step;
  return n;
}

export function ProductConfigurator({
  product,
  pricing,
  colors,
  addons,
  orderable,
}: {
  product: { id: number; slug: string; name: string; image: string | null };
  pricing: PricingProduct;
  /** value = Uzbek option stored on the order, label = shown in the current language. */
  colors: { value: string; label: string }[];
  addons: Addon[];
  orderable: boolean;
}) {
  const router = useRouter();
  const { locale, t: dict, href } = useT();
  const t = dict.product;
  const uzs = (n: number) => formatUZS(n, locale);
  const search = useSearchParams();
  const editKey = search.get("tahrir");
  const activeVariants = pricing.variants.filter((v) => v.isActive);

  const [variantId, setVariantId] = useState<number | null>(
    pricing.pricingMode === "variants" ? (activeVariants[Math.min(1, activeVariants.length - 1)]?.id ?? null) : null,
  );
  const [stems, setStems] = useState<number>(() => defaultStems(pricing));
  const [color, setColor] = useState<string | null>(colors[0]?.value ?? null);
  const [chosen, setChosen] = useState<Record<number, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Editing an existing cart line: once the cart has loaded, preload its options (state adjusted during render).
  const [cart, , cartReady] = cartStore.useStore();
  const [loadedEditKey, setLoadedEditKey] = useState<string | null>(null);
  if (cartReady && editKey && loadedEditKey !== editKey) {
    setLoadedEditKey(editKey);
    const line = cart.find((l) => l.key === editKey && l.productId === product.id);
    if (line) {
      if (line.variantId) setVariantId(line.variantId);
      if (line.stems) setStems(line.stems);
      if (line.color) setColor(line.color);
      setChosen(Object.fromEntries(line.addons.map((a) => [a.productId, a.quantity])));
      setQuantity(line.quantity);
    }
  }

  const priced = priceLine(
    pricing,
    {
      variantId,
      stems: pricing.pricingMode === "per_stem" ? stems : null,
      addons: Object.entries(chosen).map(([id, q]) => ({ productId: Number(id), quantity: q })),
      quantity,
    },
    addons,
  );

  const min = pricing.minStems ?? 1;
  const max = pricing.maxStems ?? 101;
  const step = Math.max(1, pricing.stemStep);

  function submit() {
    if (!priced.ok || !orderable) return;
    const line = {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.image,
      variantId: pricing.pricingMode === "variants" ? variantId : null,
      variantName: priced.variantName,
      stems: priced.stems,
      color,
      addons: priced.addons.map((a) => ({ productId: a.productId, quantity: a.quantity, name: a.name, price: a.unitPrice })),
      quantity,
      unitPrice: priced.unitPrice,
    };
    if (editKey) {
      replaceLine(editKey, line);
      router.push(href("/savat"));
      return;
    }
    addToCart(line);
    setAdded(true);
  }

  return (
    <div className="space-y-6">
      {pricing.pricingMode === "variants" ? (
        <fieldset>
          <legend className="label">{t.sizeLegend}</legend>
          <div className="grid grid-cols-3 gap-2">
            {activeVariants.map((v) => (
              <label
                key={v.id}
                className={`cursor-pointer rounded-xl border px-3 py-3 text-center transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest ${
                  variantId === v.id ? "border-forest bg-forest/5" : "border-line bg-white hover:border-forest/40"
                }`}
              >
                <input type="radio" name="variant" value={v.id} checked={variantId === v.id} onChange={() => setVariantId(v.id)} className="sr-only" />
                <span className="block text-sm font-semibold">{v.name}</span>
                {v.stemCount ? <span className="block text-xs text-muted">{fmt(dict.common.pieces, { n: v.stemCount })}</span> : null}
                <span className="mt-1 block text-sm text-forest">{uzs(v.price)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {pricing.pricingMode === "per_stem" ? (
        <div>
          <label htmlFor="stems" className="label">
            {t.stemsLabel} <span className="font-normal text-muted">({fmt(t.perStem, { price: uzs(pricing.stemPrice ?? 0) })})</span>
          </label>
          <div className="flex items-center gap-3">
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white hover:border-forest disabled:opacity-40" onClick={() => setStems((s) => Math.max(min, s - step))} disabled={stems <= min} aria-label={t.decrease}>
              <MinusIcon size={18} />
            </button>
            <input
              id="stems"
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={step}
              value={stems}
              onChange={(e) => setStems(Number(e.target.value))}
              className="field w-24 text-center"
              aria-describedby="stems-hint"
            />
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white hover:border-forest disabled:opacity-40" onClick={() => setStems((s) => Math.min(max, s + step))} disabled={stems >= max} aria-label={t.increase}>
              <PlusIcon size={18} />
            </button>
          </div>
          <p id="stems-hint" className="mt-1.5 text-xs text-muted">
            {fmt(t.stemsHint, { min, max })}
            {step === 2 ? t.oddOnly : ""}
          </p>
        </div>
      ) : null}

      {colors.length ? (
        <fieldset>
          <legend className="label">{t.color}</legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <label key={c.value} className={`chip cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest ${color === c.value ? "chip-active" : ""}`}>
                <input type="radio" name="color" value={c.value} checked={color === c.value} onChange={() => setColor(c.value)} className="sr-only" />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {addons.length ? (
        <fieldset>
          <legend className="label">{t.addGift}</legend>
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {addons.map((a) => {
              const q = chosen[a.productId] ?? 0;
              return (
                <li key={a.productId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <label className="flex flex-1 cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={q > 0}
                      onChange={(e) =>
                        setChosen((prev) => {
                          const next = { ...prev };
                          if (e.target.checked) next[a.productId] = 1;
                          else delete next[a.productId];
                          return next;
                        })
                      }
                      className="h-4 w-4 accent-forest"
                    />
                    <span>{a.name}</span>
                  </label>
                  <span className="text-sm text-muted">+{uzs(a.price)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-xs text-muted">{t.cardNote}</p>
        </fieldset>
      ) : null}

      <div className="rounded-2xl bg-ivory-deep p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="qty" className="text-sm font-medium">{t.quantity}</label>
            <div className="mt-1.5 flex items-center gap-2">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white disabled:opacity-40" aria-label={t.decrease}>
                <MinusIcon size={16} />
              </button>
              <input id="qty" type="number" min={1} max={MAX_LINE_QUANTITY} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(Number(e.target.value)) || 1)))} className="field w-16 px-2 py-1.5 text-center" />
              <button type="button" onClick={() => setQuantity((q) => Math.min(MAX_LINE_QUANTITY, q + 1))} disabled={quantity >= MAX_LINE_QUANTITY} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white disabled:opacity-40" aria-label={t.increase}>
                <PlusIcon size={16} />
              </button>
            </div>
          </div>
          <div className="text-right" aria-live="polite">
            <p className="text-xs text-muted">{t.total}</p>
            <p className="font-display text-3xl text-forest">{priced.ok ? uzs(priced.lineTotal) : "—"}</p>
          </div>
        </div>
        {priced.ok && (priced.addonsTotal > 0 || quantity > 1) ? (
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm text-muted">
            <div className="flex justify-between">
              <dt>{t.bouquet}</dt>
              <dd>{uzs(priced.basePrice)}</dd>
            </div>
            {priced.addons.map((a) => (
              <div key={a.productId} className="flex justify-between">
                <dt>{a.name}</dt>
                <dd>+{uzs(a.unitPrice * a.quantity)}</dd>
              </div>
            ))}
            {quantity > 1 ? (
              <div className="flex justify-between">
                <dt>{t.quantity}</dt>
                <dd>× {quantity}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {!priced.ok ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {priceErrorText(locale, priced.error)}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-muted">{t.deliveryNote}</p>
      </div>

      {orderable ? (
        <button type="button" onClick={submit} disabled={!priced.ok} className="btn-primary w-full py-4 text-base">
          {editKey ? t.updateCart : t.addToCart}
        </button>
      ) : (
        <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm">{t.unavailable}</p>
      )}

      {added ? (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <CheckIcon size={18} /> {t.added}
          </span>
          <span className="flex gap-2">
            <Link href={href("/savat")} className="btn-primary btn-sm">
              {t.goToCart}
            </Link>
            <button type="button" onClick={() => setAdded(false)} className="btn-secondary btn-sm">
              {t.continue}
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
