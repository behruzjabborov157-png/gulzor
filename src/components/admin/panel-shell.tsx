import { PanelProvider } from "@/i18n/panel/client";
import { panelDict } from "@/i18n/panel/core";
import { getLocale } from "@/i18n/server";

/** Wraps /admin and /florist pages with the panel language. */
export async function PanelShell({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <PanelProvider locale={locale} dict={panelDict(locale)}>
      {children}
    </PanelProvider>
  );
}
