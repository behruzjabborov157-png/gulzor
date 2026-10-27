import { headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { getDict } from "./dict";

/**
 * Current storefront language. The proxy (src/proxy.ts) derives it from the URL and passes it
 * as the x-locale request header, so this also works in Server Actions and Route Handlers.
 */
export async function getLocale(): Promise<Locale> {
  const v = (await headers()).get("x-locale");
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: getDict(locale) };
}
