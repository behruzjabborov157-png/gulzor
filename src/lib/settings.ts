import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type StoreSettings = {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  addressRu: string;
  /** Telegram username of the shop for customer contact, without "@". */
  telegramUsername: string;
  instagramUrl: string;
  workingHours: string;
  workingHoursRu: string;
  /** Legal entity details shown in the footer (optional). */
  legalName: string;
};

export type CheckoutSettings = {
  serviceFee: number;
  serviceFeeLabel: string;
  serviceFeeLabelRu: string;
  pickupEnabled: boolean;
  pickupAddress: string;
  pickupAddressRu: string;
  pickupPrepMinutes: number;
  cashEnabled: boolean;
  couponsEnabled: boolean;
  maxDaysAhead: number;
  /** Shows a site-wide notice that the catalog contains demo data. */
  demoMode: boolean;
  /** Payment providers the owner has switched on (credentials must also be present). */
  paymeEnabled: boolean;
  clickEnabled: boolean;
};

export const DEFAULT_STORE: StoreSettings = {
  name: "Gulzor",
  tagline: "Gullar bilan unutilmas lahzalar",
  phone: "",
  email: "",
  address: "",
  addressRu: "",
  telegramUsername: "",
  instagramUrl: "",
  workingHours: "",
  workingHoursRu: "",
  legalName: "",
};

export const DEFAULT_CHECKOUT: CheckoutSettings = {
  serviceFee: 0,
  serviceFeeLabel: "Xizmat haqi",
  serviceFeeLabelRu: "Сервисный сбор",
  pickupEnabled: false,
  pickupAddress: "",
  pickupAddressRu: "",
  pickupPrepMinutes: 60,
  cashEnabled: true,
  couponsEnabled: true,
  maxDaysAhead: 30,
  demoMode: true,
  paymeEnabled: false,
  clickEnabled: false,
};

type Settings = { store: StoreSettings; checkout: CheckoutSettings };

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select().from(schema.settings);
  const map = new Map(rows.map((r) => [r.key, r.value as Record<string, unknown>]));
  return {
    store: { ...DEFAULT_STORE, ...(map.get("store") ?? {}) } as StoreSettings,
    checkout: { ...DEFAULT_CHECKOUT, ...(map.get("checkout") ?? {}) } as CheckoutSettings,
  };
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  const db = await getDb();
  const existing = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  if (existing.length) {
    await db.update(schema.settings).set({ value, updatedAt: new Date() }).where(eq(schema.settings.key, key));
  } else {
    await db.insert(schema.settings).values({ key, value });
  }
}

export function telegramLink(username: string): string | null {
  const u = username.replace(/^@/, "").trim();
  return /^[A-Za-z0-9_]{4,32}$/.test(u) ? `https://t.me/${u}` : null;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
