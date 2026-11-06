"use client";

import { useEffect, useRef } from "react";
import { syncTelegramCartAction } from "@/app/actions";
import { useTelegram } from "@/components/telegram";
import { cartStore, lineKey, toServerLines, type CartLine } from "./cart";

const STAMP_KEY = "gulzor.tgCart.stamp";

const readStamp = () => {
  try {
    const v = Number(localStorage.getItem(STAMP_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};
const writeStamp = (v: number) => {
  try {
    localStorage.setItem(STAMP_KEY, String(v));
  } catch {
    /* private mode: the next sync merges instead */
  }
};

/** Inside the Telegram Mini App: keeps the cart the same as in the ordering bot (lib/bot/cart-sync.ts). */
export function TelegramCartSync() {
  const tg = useTelegram();
  const [lines, , hydrated] = cartStore.useStore();
  const applied = useRef<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!tg.initData || !hydrated) return;
    const current = JSON.stringify(toServerLines(lines));
    // Skip the echo of a cart that just came from the server.
    if (started.current && current === applied.current) return;
    const first = !started.current;
    started.current = true;
    const timer = setTimeout(
      async () => {
        const res = await syncTelegramCartAction(tg.initData, toServerLines(lines), readStamp()).catch(() => null);
        if (!res) return;
        writeStamp(res.stamp);
        const next: CartLine[] = res.lines.map((l) => ({ ...l, key: lineKey(l) }));
        applied.current = JSON.stringify(toServerLines(next));
        if (applied.current !== current) cartStore.set(next);
      },
      first ? 0 : 700,
    );
    return () => clearTimeout(timer);
  }, [tg.initData, hydrated, lines]);

  return null;
}
