"use server";

import { cookies } from "next/headers";
import { isLocale } from "@/i18n/config";
import { PANEL_COOKIE } from "@/i18n/panel/core";

export async function setPanelLanguageAction(locale: string) {
  if (!isLocale(locale)) return;
  const https = (process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || "").startsWith("https://");
  (await cookies()).set(PANEL_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: https });
}
