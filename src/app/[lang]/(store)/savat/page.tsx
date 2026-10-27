import type { Metadata } from "next";
import { CartView } from "@/components/store/cart-view";
import { getDict } from "@/i18n/dict";
import { getLocale } from "@/i18n/server";
import { getDeliveryConfig } from "@/lib/delivery";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDict(await getLocale()).meta.cart, robots: { index: false } };
}

export default async function CartPage() {
  const locale = await getLocale();
  const { regions } = await getDeliveryConfig(locale);
  const zones = regions.flatMap((r) =>
    r.zones.map((z) => ({ id: z.id, label: `${r.name}, ${z.name}`, fee: z.fee, freeFrom: z.freeFrom, minOrder: z.minOrder })),
  );
  return (
    <div className="container-page pt-10">
      <h1 className="mb-8 text-4xl sm:text-5xl">{getDict(locale).cart.title}</h1>
      <CartView zones={zones} />
    </div>
  );
}
