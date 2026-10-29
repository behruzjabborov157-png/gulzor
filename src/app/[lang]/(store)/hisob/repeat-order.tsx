"use client";

import { useRouter } from "next/navigation";
import { addToCart, cartStore, conflictsWithCart } from "@/components/store/cart";
import { useT } from "@/i18n/client";

type Item = {
  productId: number;
  slug: string;
  variantId: number | null;
  stems: number | null;
  color: string | null;
  quantity: number;
  name: string;
  variantName: string | null;
  image: string | null;
  unitPrice: number;
  addons: { productId: number; name: string; unitPrice: number; quantity: number }[];
};

/** Puts the same items back in the cart. The cart re-checks current prices and availability on the server. */
export function RepeatOrder({ items, floristId, floristName }: { items: Item[]; floristId: number; floristName: string }) {
  const router = useRouter();
  const { t, href } = useT();
  return (
    <button
      type="button"
      className="btn-secondary btn-sm"
      onClick={() => {
        // Repeating an order means that shop's items: a cart from another shop is replaced (one shop per order).
        if (conflictsWithCart(cartStore.get(), { floristId })) cartStore.set([]);
        for (const i of items) {
          addToCart({
            floristId,
            floristName,
            productId: i.productId,
            slug: i.slug,
            name: i.name,
            image: i.image,
            variantId: i.variantId,
            variantName: i.variantName,
            stems: i.stems,
            color: i.color,
            addons: i.addons.map((a) => ({ productId: a.productId, quantity: a.quantity, name: a.name, price: a.unitPrice })),
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          });
        }
        router.push(href("/savat"));
      }}
    >
      {t.account.repeat}
    </button>
  );
}
