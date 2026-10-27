"use client";

import { submitWithoutReset } from "@/lib/use-form-submit";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { productCardsAction, subscribeAction } from "@/app/actions";
import { PhoneInput } from "@/components/ui/phone-input";
import { Price, ProductImage } from "@/components/ui/primitives";
import type { ProductCard } from "@/lib/catalog-shared";
import type { FormState } from "@/lib/form-state";
import { useT } from "@/i18n/client";
import { favoritesStore, recentStore } from "./cart";

export function Newsletter() {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribeAction, {});
  const t = useT().t.home.newsletter;
  if (state.ok) {
    return <p className="rounded-xl bg-ivory/10 px-4 py-3 text-ivory" role="status">{state.message}</p>;
  }
  return (
    <form onSubmit={submitWithoutReset(action)} className="w-full max-w-md" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="nl-phone" className="sr-only">{t.phoneLabel}</label>
        <PhoneInput
          id="nl-phone"
          name="phone"
          className="field border-ivory/20 bg-ivory/95"
          aria-invalid={!!state.errors?.phone}
          aria-describedby={state.errors?.phone ? "nl-phone-err" : undefined}
          required
        />
        <button className="btn-light shrink-0" disabled={pending}>
          {pending ? t.sending : t.submit}
        </button>
      </div>
      {state.errors?.phone ? <p id="nl-phone-err" className="mt-1.5 text-sm text-blush">{state.errors.phone}</p> : null}
      <label className="mt-3 flex items-start gap-2.5 text-xs leading-relaxed text-ivory/75">
        <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 shrink-0 accent-blush" required />
        <span>{t.consent}</span>
      </label>
      {state.errors?.consent ? <p className="mt-1 text-sm text-blush">{state.errors.consent}</p> : null}
      {state.message && !state.ok ? <p className="mt-1 text-sm text-blush">{state.message}</p> : null}
    </form>
  );
}

/** Loads product cards for the given ids. Returns null while loading, [] when there is nothing to show. */
function useCards(ids: number[], hydrated: boolean, exclude?: number) {
  const [loaded, setLoaded] = useState<{ key: string; cards: ProductCard[] } | null>(null);
  const key = ids.filter((x) => x !== exclude).join(",");
  useEffect(() => {
    if (!hydrated || !key) return;
    let alive = true;
    productCardsAction(key.split(",").map(Number)).then((cards) => alive && setLoaded({ key, cards }));
    return () => {
      alive = false;
    };
  }, [key, hydrated]);
  if (!hydrated) return null;
  if (!key) return [];
  return loaded?.key === key ? loaded.cards : null;
}

export function RecentlyViewed({ excludeId }: { excludeId?: number }) {
  const [ids, , hydrated] = recentStore.useStore();
  const { locale, t, href } = useT();
  const cards = useCards(ids.slice(0, 7), hydrated, excludeId);
  if (!cards || cards.length === 0) return null;
  return (
    <section className="container-page mt-20" aria-labelledby="recent-h">
      <h2 id="recent-h" className="mb-6 text-3xl">{t.home.recent}</h2>
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {cards.slice(0, 6).map((p) => (
          <Link key={p.id} href={href(`/gul/${p.slug}`)} className="w-40 shrink-0 snap-start sm:w-48">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-ivory-deep">
              <ProductImage src={p.image?.url} alt={p.name} sizes="200px" locale={locale} />
            </div>
            <p className="mt-2 line-clamp-2 text-sm">{p.name}</p>
            <Price value={p.price} from={p.hasOptions} locale={locale} className="text-sm" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function useFavoriteCards() {
  const [ids, , hydrated] = favoritesStore.useStore();
  const cards = useCards(ids, hydrated);
  return { cards, hydrated };
}
