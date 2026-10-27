"use client";

import { useEffect, useRef, useState } from "react";
import { quoteAction } from "@/app/actions";
import type { Quote, QuoteInput } from "@/lib/quote";
import { useT } from "@/i18n/client";
import { createLocalStore } from "./local-store";

/** Remembers the coupon and delivery zone between the cart and checkout pages. */
export const prefsStore = createLocalStore<{ couponCode: string; zoneId: number | null }>(
  "gulzor.checkout.v1",
  { couponCode: "", zoneId: null },
  (v) => {
    const o = (v ?? {}) as { couponCode?: unknown; zoneId?: unknown };
    return {
      couponCode: typeof o.couponCode === "string" ? o.couponCode.slice(0, 40) : "",
      zoneId: Number.isInteger(o.zoneId) ? (o.zoneId as number) : null,
    };
  },
);

const OFFLINE = "__offline__";

/** Asks the server for authoritative prices whenever the input or language changes (debounced). */
export function useQuote(input: QuoteInput | null) {
  const { locale, t } = useT();
  // The last server answer, tagged with the input it belongs to.
  const [result, setResult] = useState<{ key: string; quote: Quote | null; error: string | null }>({ key: "", quote: null, error: null });
  const seq = useRef(0);
  // The language is part of the key: names and messages in the quote are localized.
  const key = input ? JSON.stringify([locale, input]) : "";

  useEffect(() => {
    if (!key) return;
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await quoteAction((JSON.parse(key) as [string, QuoteInput])[1]);
        if (id !== seq.current) return;
        setResult((prev) => (res.ok ? { key, quote: res.quote, error: null } : { key, quote: prev.quote, error: res.error }));
      } catch {
        if (id === seq.current) setResult((prev) => ({ key, quote: prev.quote, error: OFFLINE }));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [key]);

  // Loading until the answer for the current input has arrived; the previous quote stays visible meanwhile.
  const error = result.error === OFFLINE ? t.errors.form.offline : result.error;
  return { quote: result.quote, error, loading: !!key && result.key !== key };
}
