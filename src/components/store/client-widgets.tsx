"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { setFavoriteAction, syncFavoritesAction } from "@/app/actions";
import { BagIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon } from "@/components/ui/icons";
import { cartStore, favoritesStore, pushRecent } from "./cart";

let remoteFavorites = false;

/** Merges guest favorites into the account once the customer is signed in. */
export function FavoritesSync({ loggedIn }: { loggedIn: boolean }) {
  useEffect(() => {
    remoteFavorites = loggedIn;
    if (!loggedIn) return;
    syncFavoritesAction(favoritesStore.get()).then((ids) => {
      if (ids) favoritesStore.set(ids);
    });
  }, [loggedIn]);
  return null;
}

export function FavoriteButton({ productId, name, className = "" }: { productId: number; name: string; className?: string }) {
  const [favs, setFavs, hydrated] = favoritesStore.useStore();
  const active = hydrated && favs.includes(productId);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `${name} — sevimlilardan olib tashlash` : `${name} — sevimlilarga qo‘shish`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !active;
        setFavs((prev) => (next ? [productId, ...prev.filter((x) => x !== productId)] : prev.filter((x) => x !== productId)));
        if (remoteFavorites) setFavoriteAction(productId, next);
      }}
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-forest shadow-sm backdrop-blur transition hover:scale-105 ${active ? "text-rose" : ""} ${className}`}
    >
      <HeartIcon filled={active} size={18} />
    </button>
  );
}

export function CartLink() {
  const [lines, , hydrated] = cartStore.useStore();
  const count = hydrated ? lines.reduce((s, l) => s + l.quantity, 0) : 0;
  return (
    <Link href="/savat" className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-forest/5" aria-label={`Savat, ${count} ta mahsulot`}>
      <BagIcon size={22} />
      {count > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-forest px-1 text-[11px] font-bold text-ivory">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export function FavoritesLink() {
  const [favs, , hydrated] = favoritesStore.useStore();
  const n = hydrated ? favs.length : 0;
  return (
    <Link href="/sevimlilar" className="relative hidden h-10 w-10 items-center justify-center rounded-full hover:bg-forest/5 sm:flex" aria-label={`Sevimlilar, ${n} ta`}>
      <HeartIcon size={21} />
      {n > 0 ? <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose" aria-hidden="true" /> : null}
    </Link>
  );
}

export function SearchBox({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/katalog?q=${encodeURIComponent(term)}` : "/katalog");
        onDone?.();
      }}
      className="relative w-full"
    >
      <label htmlFor={id} className="sr-only">
        Gullarni qidirish
      </label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Atirgul, lola, guldasta…"
        className="field rounded-full py-2.5 pr-11 pl-4"
        maxLength={80}
      />
      <button type="submit" className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-forest hover:bg-forest/5" aria-label="Qidirish">
        <SearchIcon size={18} />
      </button>
    </form>
  );
}

export function SearchToggle() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Qidiruv"
        className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-forest/5 lg:hidden"
      >
        <SearchIcon size={21} />
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-full z-40 border-b border-line bg-ivory p-4 lg:hidden">
          <SearchBox autoFocus onDone={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  );
}

export type NavItem = { href: string; label: string };

export function MobileNav({ items, extra }: { items: NavItem[]; extra: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menyuni ochish"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-forest/5 lg:hidden"
      >
        <MenuIcon size={22} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menyu">
          <div className="absolute inset-0 bg-charcoal/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col overflow-y-auto bg-ivory p-6 shadow-xl animate-fade-up">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-2xl text-forest">Menyu</span>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Yopish" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-forest/5">
                <CloseIcon />
              </button>
            </div>
            <SearchBox onDone={() => setOpen(false)} />
            <nav className="mt-6 flex flex-col" aria-label="Asosiy">
              {items.map((it) => (
                <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className="border-b border-line py-3.5 text-lg text-charcoal hover:text-forest">
                  {it.label}
                </Link>
              ))}
            </nav>
            <nav className="mt-6 flex flex-col gap-3 text-sm text-muted" aria-label="Qo‘shimcha">
              {extra.map((it) => (
                <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className="hover:text-forest">
                  {it.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function TrackRecent({ id }: { id: number }) {
  useEffect(() => pushRecent(id), [id]);
  return null;
}
