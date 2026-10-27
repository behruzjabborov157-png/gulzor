import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { CheckoutForm } from "@/components/store/checkout-form";
import { getCustomer } from "@/lib/auth";
import { dateWindow, getDeliveryConfig } from "@/lib/delivery";
import { formatPhone } from "@/lib/format";
import { availablePaymentMethods } from "@/lib/payments/config";
import { getSettings, telegramLink } from "@/lib/settings";
import { addDaysISO } from "@/lib/time";

export const metadata: Metadata = { title: "Buyurtmani rasmiylashtirish", robots: { index: false } };

export default async function CheckoutPage() {
  const [{ regions }, { checkout, store }, customer] = await Promise.all([getDeliveryConfig(), getSettings(), getCustomer()]);
  const win = dateWindow(checkout.maxDaysAhead);
  const addresses = customer
    ? await (await getDb()).select().from(schema.customerAddresses).where(eq(schema.customerAddresses.customerId, customer.id))
    : [];

  return (
    <div className="container-page pt-10">
      <h1 className="mb-8 text-4xl sm:text-5xl">Buyurtmani rasmiylashtirish</h1>
      <CheckoutForm
        regions={regions.map((r) => ({ id: r.id, name: r.name, zones: r.zones.map((z) => ({ id: z.id, name: z.name, description: z.description, fee: z.fee })) }))}
        pickup={{ enabled: checkout.pickupEnabled, address: checkout.pickupAddress }}
        payments={availablePaymentMethods(checkout)}
        dates={{ min: win.min, max: win.max, today: win.min, tomorrow: addDaysISO(win.min, 1) }}
        customer={customer ? { name: customer.name, phone: formatPhone(customer.phone) } : null}
        addresses={addresses.map((a) => ({
          id: a.id,
          label: a.label,
          recipientName: a.recipientName,
          recipientPhone: a.recipientPhone,
          zoneId: a.zoneId,
          district: a.district,
          neighborhood: a.neighborhood,
          address: a.address,
          apartment: a.apartment,
          landmark: a.landmark,
        }))}
        contactHref={telegramLink(store.telegramUsername) ?? (store.phone ? `tel:${store.phone}` : null)}
      />
    </div>
  );
}
