"use client";

import { useEffect, useRef, useState } from "react";
import { quoteAction } from "@/app/actions";
import type { Quote, QuoteInput } from "@/lib/quote";
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

/** Asks the server for authoritative prices whenever the input changes (debounced). */
export function useQuote(input: QuoteInput | null) {
  // The last server answer, tagged with the input it belongs to.
  const [result, setResult] = useState<{ key: string; quote: Quote | null; error: string | null }>({ key: "", quote: null, error: null });
  const seq = useRef(0);
  const key = input ? JSON.stringify(input) : "";

  useEffect(() => {
    if (!key) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await quoteAction(JSON.parse(key));
        if (id !== seq.current) return;
        setResult((prev) => (res.ok ? { key, quote: res.quote, error: null } : { key, quote: prev.quote, error: res.error }));
      } catch {
        if (id === seq.current) setResult((prev) => ({ key, quote: prev.quote, error: "Server bilan aloqa yo‘q. Internet aloqasini tekshiring." }));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [key]);

  // Loading until the answer for the current input has arrived; the previous quote stays visible meanwhile.
  return { quote: result.quote, error: result.error, loading: !!key && result.key !== key };
}
