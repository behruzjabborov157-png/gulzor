import type { CheckoutSettings } from "@/lib/settings";

export type PaymentMethod = "cash" | "payme" | "click";

export function paymeCredentials() {
  const merchantId = process.env.PAYME_MERCHANT_ID;
  const key = process.env.PAYME_KEY;
  if (!merchantId || !key) return null;
  return { merchantId, key, checkoutUrl: (process.env.PAYME_CHECKOUT_URL || "https://checkout.paycom.uz").replace(/\/$/, "") };
}

export function clickCredentials() {
  const serviceId = process.env.CLICK_SERVICE_ID;
  const merchantId = process.env.CLICK_MERCHANT_ID;
  const secretKey = process.env.CLICK_SECRET_KEY;
  if (!serviceId || !merchantId || !secretKey) return null;
  return { serviceId, merchantId, secretKey, merchantUserId: process.env.CLICK_MERCHANT_USER_ID ?? "" };
}

/**
 * Methods offered to customers. An online provider is only shown when the
 * owner enabled it in settings AND its server-side credentials exist.
 */
export function availablePaymentMethods(c: CheckoutSettings): { id: PaymentMethod; label: string; hint: string }[] {
  const list: { id: PaymentMethod; label: string; hint: string }[] = [];
  if (c.cashEnabled) list.push({ id: "cash", label: "Naqd pul", hint: "Buyurtmani qabul qilganda kuryerga yoki do‘konda to‘lanadi" });
  if (c.paymeEnabled && paymeCredentials()) list.push({ id: "payme", label: "Payme", hint: "Payme orqali onlayn to‘lov" });
  if (c.clickEnabled && clickCredentials()) list.push({ id: "click", label: "Click", hint: "Click orqali onlayn to‘lov" });
  return list;
}
