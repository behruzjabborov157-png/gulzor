"use client";

import { createLocalStore } from "./local-store";

export type CartAddon = { productId: number; quantity: number; name: string; price: number };

export type CartLine = {
  key: string;
  productId: number;
  slug: string;
  name: string;
  image: string | null;
  variantId: number | null;
  variantName: string | null;
  stems: number | null;
  color: string | null;
  addons: CartAddon[];
  quantity: number;
  /** Price shown when the item was added. The server recalculates on every quote. */
  unitPrice: number;
};

function isLine(x: unknown): x is CartLine {
  const l = x as CartLine;
  return !!l && typeof l.key === "string" && Number.isInteger(l.productId) && Number.isInteger(l.quantity) && Array.isArray(l.addons);
}

export const cartStore = createLocalStore<CartLine[]>("gulzor.cart.v1", [], (v) => (Array.isArray(v) ? v.filter(isLine).slice(0, 30) : []));

export function lineKey(l: Pick<CartLine, "productId" | "variantId" | "stems" | "color" | "addons">) {
  const addons = [...l.addons].sort((a, b) => a.productId - b.productId).map((a) => `${a.productId}x${a.quantity}`).join(",");
  return [l.productId, l.variantId ?? "-", l.stems ?? "-", l.color ?? "-", addons].join("|");
}

export const CART_ADDED_EVENT = "gulzor:cart-added";

export function addToCart(line: Omit<CartLine, "key">) {
  const key = lineKey(line);
  cartStore.set((prev) => {
    const existing = prev.find((x) => x.key === key);
    if (existing) {
      return prev.map((x) => (x.key === key ? { ...x, quantity: Math.min(20, x.quantity + line.quantity), unitPrice: line.unitPrice } : x));
    }
    return [...prev, { ...line, key }];
  });
  // Opens the cart drawer (components/store/cart-drawer.tsx).
  window.dispatchEvent(new CustomEvent<CartLine>(CART_ADDED_EVENT, { detail: { ...line, key } }));
}

export function updateQuantity(key: string, quantity: number) {
  cartStore.set((prev) => prev.map((x) => (x.key === key ? { ...x, quantity: Math.max(1, Math.min(20, Math.floor(quantity) || 1)) } : x)));
}

export function removeLine(key: string) {
  cartStore.set((prev) => prev.filter((x) => x.key !== key));
}

export function replaceLine(oldKey: string, line: Omit<CartLine, "key">) {
  const key = lineKey(line);
  cartStore.set((prev) => {
    const without = prev.filter((x) => x.key !== oldKey && x.key !== key);
    const idx = prev.findIndex((x) => x.key === oldKey);
    const next = [...without];
    next.splice(Math.max(0, Math.min(idx, next.length)), 0, { ...line, key });
    return next;
  });
}

export function clearCart() {
  cartStore.set([]);
}

/** Shape sent to the server — prices are deliberately not included. */
export function toServerLines(lines: CartLine[]) {
  return lines.map((l) => ({
    productId: l.productId,
    variantId: l.variantId,
    stems: l.stems,
    color: l.color,
    addons: l.addons.map((a) => ({ productId: a.productId, quantity: a.quantity })),
    quantity: l.quantity,
  }));
}

export const recentStore = createLocalStore<number[]>("gulzor.recent.v1", [], (v) =>
  Array.isArray(v) ? v.filter((x) => Number.isInteger(x)).slice(0, 12) : [],
);

export function pushRecent(id: number) {
  recentStore.set((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 12));
}

export const favoritesStore = createLocalStore<number[]>("gulzor.favorites.v1", [], (v) =>
  Array.isArray(v) ? v.filter((x) => Number.isInteger(x)).slice(0, 100) : [],
);
