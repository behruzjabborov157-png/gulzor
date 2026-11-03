import { getLocale } from "@/i18n/server";
import { makeT, panelDict, type PanelT } from "./core";

/** Translator for server components and server actions (language: the panel cookie, passed on by src/proxy.ts). */
export async function panelT(): Promise<PanelT> {
  const locale = await getLocale();
  return makeT(panelDict(locale), locale);
}
