"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, CloseIcon, InfoIcon } from "@/components/ui/icons";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { formatUZS } from "@/lib/format";
import { CART_ADDED_EVENT, CART_CONFLICT_EVENT, cartFlorist, cartStore, replaceCartWith, type CartLine } from "./cart";

/**
 * Slide-in confirmation after "add to cart": shows what was added and the cart size,
 * with the way to the cart or back to shopping. Esc, the backdrop and navigation close it.
 * When the item comes from another shop than the cart (one shop per order) it asks instead.
 */
export function CartDrawer() {
  const { t, locale, href } = useT();
  const tp = t.product;
  const ts = t.shop;
  const [line, setLine] = useState<CartLine | null>(null);
  const [conflict, setConflict] = useState<Omit<CartLine, "key"> | null>(null);
  const [open, setOpen] = useState(false);
  const [lines] = cartStore.useStore();
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const count = lines.reduce((s, l) => s + l.quantity, 0);

  useEffect(() => {
    const onAdded = (e: Event) => {
      lastFocus.current = document.activeElement as HTMLElement | null;
      setConflict(null);
      setLine((e as CustomEvent<CartLine>).detail);
      setOpen(true);
    };
    const onConflict = (e: Event) => {
      lastFocus.current = document.activeElement as HTMLElement | null;
      setConflict((e as CustomEvent<Omit<CartLine, "key">>).detail);
      setOpen(true);
    };
    window.addEventListener(CART_ADDED_EVENT, onAdded);
    window.addEventListener(CART_CONFLICT_EVENT, onConflict);
    return () => {
      window.removeEventListener(CART_ADDED_EVENT, onAdded);
      window.removeEventListener(CART_CONFLICT_EVENT, onConflict);
    };
  }, []);

  // Close when the route changes (e.g. after "Go to cart").
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    lastFocus.current?.focus?.();
  }

  const details = line
    ? [line.variantName, line.stems ? fmt(tp.stemsCount, { n: line.stems }) : null, ...line.addons.map((a) => `+ ${a.name}`)].filter(Boolean).join(" · ")
    : "";

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <div
        className={`absolute inset-0 bg-plum/40 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={close}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className={`absolute top-0 right-0 flex h-full w-full max-w-sm flex-col bg-ivory shadow-[var(--shadow-lift)] transition-[translate,visibility] duration-500 ease-[var(--ease-out-soft)] ${
          open ? "visible translate-x-0" : "invisible translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          {conflict ? (
            <p id="cart-drawer-title" className="inline-flex items-center gap-2 font-semibold text-wine">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-wine/10">
                <InfoIcon size={16} />
              </span>
              {ts.conflictTitle}
            </p>
          ) : (
            <p id="cart-drawer-title" className="inline-flex items-center gap-2 font-semibold text-success">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success/10">
                <CheckIcon size={16} />
              </span>
              {tp.added}
            </p>
          )}
          <button ref={closeRef} type="button" onClick={close} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-wine/5" aria-label={tp.close}>
            <CloseIcon size={20} />
          </button>
        </div>
        {conflict ? (
          <div className="flex flex-1 flex-col">
            <p className="px-5 py-5 text-sm leading-relaxed text-charcoal">{fmt(ts.conflictText, { current: cartFlorist(lines)?.name || "—" })}</p>
            <div className="mt-auto space-y-2 border-t border-line p-5">
              <button
                type="button"
                className="btn-primary w-full py-3.5"
                onClick={() => {
                  const next = conflict;
                  setConflict(null);
                  replaceCartWith(next);
                }}
              >
                {ts.conflictReplace}
              </button>
              <button type="button" onClick={close} className="btn-secondary w-full py-3.5">
                {ts.conflictKeep}
              </button>
            </div>
          </div>
        ) : null}
        {!conflict && line ? (
          <div className="flex gap-4 px-5 py-5">
            <div className="relative h-28 w-22 shrink-0 overflow-hidden rounded-xl bg-cream">
              {line.image ? <Image src={line.image} alt="" fill sizes="88px" className="object-cover" /> : null}
            </div>
            <div className="min-w-0">
              <p className="font-display text-xl leading-tight text-plum">{line.name}</p>
              {details ? <p className="mt-1 text-sm text-muted">{details}</p> : null}
              {line.floristName ? <p className="mt-1 text-xs text-muted">{fmt(ts.cartFrom, { name: line.floristName })}</p> : null}
              <p className="mt-2 font-semibold text-wine">
                {line.quantity > 1 ? `${line.quantity} × ` : ""}
                {formatUZS(line.unitPrice, locale)}
              </p>
            </div>
          </div>
        ) : null}
        {conflict ? null : (
          <>
        <p className="px-5 text-sm text-muted">{fmt(tp.inCart, { n: count })}</p>
        <div className="mt-auto space-y-2 border-t border-line p-5">
          <Link href={href("/savat")} className="btn-primary w-full py-3.5">
            {tp.goToCart}
          </Link>
          <button type="button" onClick={close} className="btn-secondary w-full py-3.5">
            {tp.continue}
          </button>
        </div>
          </>
        )}
      </aside>
    </div>
  );
}
