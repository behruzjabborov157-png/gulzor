import { clickCheckoutUrl } from "./click";
import { clickCredentials, paymeCredentials } from "./config";
import { paymeCheckoutUrl } from "./payme";
import type { ProviderId } from "./status";

/**
 * What the shop needs from a payment provider. Its callbacks live in their own route under /api/payments and must
 * settle through settlePayment() (status.ts). To add a provider: implement this and add its id to payment_method.
 */
export type PaymentProvider = {
  id: ProviderId;
  label: string;
  /** Server credentials exist. */
  configured: () => boolean;
  /** Connected to the provider's test environment: no real money moves. */
  testMode: () => boolean;
  checkoutUrl: (order: { number: string; total: number }, returnUrl: string) => string | null;
};

export const PROVIDERS: Record<ProviderId, PaymentProvider> = {
  payme: {
    id: "payme",
    label: "Payme",
    configured: () => !!paymeCredentials(),
    testMode: () => (paymeCredentials()?.checkoutUrl ?? "").includes("test.paycom.uz"),
    checkoutUrl: (o, url) => paymeCheckoutUrl(o.number, o.total, url),
  },
  click: {
    id: "click",
    label: "Click",
    configured: () => !!clickCredentials(),
    testMode: () => process.env.CLICK_TEST_MODE === "1",
    checkoutUrl: (o, url) => clickCheckoutUrl(o.number, o.total, url),
  },
};

export const onlineProvider = (method: string): PaymentProvider | null => (method === "payme" || method === "click" ? PROVIDERS[method] : null);
