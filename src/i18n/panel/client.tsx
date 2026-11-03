"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/i18n/config";
import { makeT, type PanelDict, type PanelT } from "./core";

const Ctx = createContext<{ locale: Locale; t: PanelT }>({ locale: "uz", t: makeT({}) });

/** Gets only the current language's dictionary from the server, so panel texts never reach the storefront bundle. */
export function PanelProvider({ locale, dict, children }: { locale: Locale; dict: PanelDict; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeT(dict, locale) }), [locale, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePanelT = () => useContext(Ctx).t;
export const usePanelLocale = () => useContext(Ctx).locale;
