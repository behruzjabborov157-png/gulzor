import type { Metadata } from "next";
import { CartView } from "@/components/store/cart-view";
import { getDeliveryConfig } from "@/lib/delivery";

export const metadata: Metadata = { title: "Savat", robots: { index: false } };

export default async function CartPage() {
  const { regions } = await getDeliveryConfig();
  const zones = regions.flatMap((r) =>
    r.zones.map((z) => ({ id: z.id, label: `${r.name}, ${z.name}`, fee: z.fee, freeFrom: z.freeFrom, minOrder: z.minOrder })),
  );
  return (
    <div className="container-page pt-10">
      <h1 className="mb-8 text-4xl sm:text-5xl">Savat</h1>
      <CartView zones={zones} />
    </div>
  );
}
