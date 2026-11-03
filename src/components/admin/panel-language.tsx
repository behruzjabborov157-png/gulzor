"use client";

import { useState } from "react";
import { setPanelLanguageAction } from "@/app/panel-language";
import { LOCALES, type Locale } from "@/i18n/config";
import { usePanelLocale } from "@/i18n/panel/client";

const NAMES = { uz: "O‘z", ru: "Ру", en: "En" };

/** Language of the admin / florist panel, remembered in a cookie. The proxy reads it per request, hence the full reload. */
export function PanelLanguage({ className = "" }: { className?: string }) {
  const locale = usePanelLocale();
  const [busy, setBusy] = useState(false);
  async function choose(l: Locale) {
    setBusy(true);
    await setPanelLanguageAction(l);
    window.location.reload();
  }
  return (
    <div className={`flex gap-1 ${className}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          disabled={busy}
          onClick={() => choose(l)}
          aria-pressed={l === locale}
          className={`rounded-lg px-2 py-1 text-xs font-semibold ${l === locale ? "bg-wine text-ivory" : "text-muted hover:bg-cream"}`}
        >
          {NAMES[l]}
        </button>
      ))}
    </div>
  );
}
