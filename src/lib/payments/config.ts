import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
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
 * Marketplace shops (platformShop: false) are paid by the customer directly, so they only take cash on
 * delivery: Payme/Click would put the money into Gulzor's merchant account instead of the shop's.
 */
export function availablePaymentMethods(
  c: CheckoutSettings,
  locale: Locale = DEFAULT_LOCALE,
  opts: { platformShop?: boolean } = {},
): { id: PaymentMethod; label: string; hint: string }[] {
  const t = getDict(locale).checkout.payments;
  if (opts.platformShop === false) return [{ id: "cash", ...t.cash }];
  const ids: PaymentMethod[] = [];
  if (c.cashEnabled) ids.push("cash");
  if (c.paymeEnabled && paymeCredentials()) ids.push("payme");
  if (c.clickEnabled && clickCredentials()) ids.push("click");
  return ids.map((id) => ({ id, ...t[id] }));
}
