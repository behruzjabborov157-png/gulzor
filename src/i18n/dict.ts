/**
 * Storefront dictionary. Each namespace file exports { uz, ru } where ru is typed as typeof uz,
 * so a missing Russian string is a compile error. Use fmt() from ./config for {placeholders}.
 */
import account from "./ns/account";
import cart from "./ns/cart";
import catalog from "./ns/catalog";
import checkout from "./ns/checkout";
import common from "./ns/common";
import custom from "./ns/custom";
import delivery from "./ns/delivery";
import errors from "./ns/errors";
import home from "./ns/home";
import layout from "./ns/layout";
import meta from "./ns/meta";
import order from "./ns/order";
import product from "./ns/product";
import shop from "./ns/shop";
import { fmt, type Locale } from "./config";

const namespaces = { account, cart, catalog, checkout, common, custom, delivery, errors, home, layout, meta, order, product, shop };

type Namespaces = typeof namespaces;
export type Dict = { [K in keyof Namespaces]: Namespaces[K]["uz"] };

const build = (locale: Locale) =>
  Object.fromEntries(Object.entries(namespaces).map(([k, v]) => [k, v[locale]])) as Dict;

const dictionaries: Record<Locale, Dict> = { uz: build("uz"), ru: build("ru") };

export function getDict(locale: Locale): Dict {
  return dictionaries[locale];
}

/** Translates a pricing error code from lib/pricing.ts. */
export function priceErrorText(locale: Locale, e: { code: keyof Dict["errors"]["price"]; params?: Record<string, number> }): string {
  return fmt(getDict(locale).errors.price[e.code], e.params);
}
