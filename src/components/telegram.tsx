"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { localePath, splitLocale } from "@/i18n/config";

/**
 * Telegram Mini App integration. The same website runs inside Telegram when opened from the
 * shop bot's "Do‘kon" button. Telegram's script is loaded only in that case (Telegram puts
 * tgWebAppData in the URL hash; the script keeps it in sessionStorage for later pages).
 */
type WebAppUser = { id: number; first_name: string; last_name?: string; username?: string; language_code?: string };
type ContactResult = { status: string; responseUnsafe?: { contact?: { phone_number?: string } } };
type WebApp = {
  initData: string;
  initDataUnsafe: { user?: WebAppUser };
  isVersionAtLeast: (v: string) => boolean;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  disableVerticalSwipes?: () => void;
  requestContact?: (cb: (shared: boolean, res?: ContactResult) => void) => void;
  BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
};
declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}

const SCRIPT_URL = "https://telegram.org/js/telegram-web-app.js";

type TelegramState = {
  /** True when the site is running inside Telegram as a Mini App with a user. */
  active: boolean;
  user: WebAppUser | null;
  /** Raw signed initData — sent with the order and verified on the server. */
  initData: string;
  /** Asks Telegram for the user's phone (native consent popup). Resolves to the number or null. */
  requestPhone: () => Promise<string | null>;
};

const TelegramContext = createContext<TelegramState>({ active: false, user: null, initData: "", requestPhone: async () => null });

export function useTelegram() {
  return useContext(TelegramContext);
}

function launchedFromTelegram() {
  try {
    return location.hash.includes("tgWebAppData") || (sessionStorage.getItem("__telegram__initParams") ?? "").includes("tgWebAppData");
  } catch {
    return false;
  }
}

function loadScript(): Promise<void> {
  if (window.Telegram?.WebApp) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("telegram-web-app.js failed to load"));
    document.head.appendChild(s);
  });
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [webApp, setWebApp] = useState<WebApp | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!launchedFromTelegram()) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        const wa = window.Telegram?.WebApp;
        if (cancelled || !wa?.initData) return;
        wa.ready();
        wa.expand();
        if (wa.isVersionAtLeast("6.1")) {
          wa.setHeaderColor?.("#fbf6ef");
          wa.setBackgroundColor?.("#fbf6ef");
        }
        // Lets long pages scroll without accidentally closing the app (Bot API 7.7+).
        if (wa.isVersionAtLeast("7.7")) wa.disableVerticalSwipes?.();
        document.documentElement.setAttribute("data-telegram", "");
        setWebApp(wa);
      })
      .catch(() => {
        // Outside a real Telegram client the site simply works as a website.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Russian-speaking Telegram users start on the Russian version (once per session).
  useEffect(() => {
    const lang = webApp?.initDataUnsafe.user?.language_code ?? "";
    if (!webApp || !lang.startsWith("ru")) return;
    try {
      if (sessionStorage.getItem("gulzor.tgLang")) return;
      sessionStorage.setItem("gulzor.tgLang", "1");
    } catch {
      return;
    }
    const { locale, path } = splitLocale(pathname);
    if (locale !== "ru") router.replace(localePath("ru", path));
  }, [webApp, pathname, router]);

  // Telegram's own Back button replaces the browser's on inner pages.
  useEffect(() => {
    if (!webApp || !webApp.isVersionAtLeast("6.1")) return;
    const back = () => router.back();
    const { path } = splitLocale(pathname);
    if (path === "/") webApp.BackButton.hide();
    else {
      webApp.BackButton.show();
      webApp.BackButton.onClick(back);
    }
    return () => webApp.BackButton.offClick(back);
  }, [webApp, pathname, router]);

  const requestPhone = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        if (!webApp?.requestContact || !webApp.isVersionAtLeast("6.9")) return resolve(null);
        try {
          webApp.requestContact((shared, res) => resolve(shared ? (res?.responseUnsafe?.contact?.phone_number ?? null) : null));
        } catch {
          resolve(null);
        }
      }),
    [webApp],
  );

  const value = useMemo<TelegramState>(
    () => ({ active: !!webApp, user: webApp?.initDataUnsafe.user ?? null, initData: webApp?.initData ?? "", requestPhone }),
    [webApp, requestPhone],
  );
  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}
