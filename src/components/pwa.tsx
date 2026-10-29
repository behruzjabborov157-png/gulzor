"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";

/** Registers /sw.js (production only — in development it would cache stale builds). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // An unsupported or blocked service worker only means no offline page — the site still works.
    });
  }, []);
  return null;
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/**
 * "Install the app" button. Android/desktop Chrome: opens the browser's own install dialog
 * (shown only after the browser fires beforeinstallprompt). iPhone/iPad Safari has no such
 * dialog, so the button reveals the Share → "Add to Home Screen" instructions instead.
 */
export function InstallApp() {
  const { t } = useT();
  const tx = t.layout.install;
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Read once after mount; the server render never shows the button.
    const id = window.setTimeout(() => setIos(isIos()), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return <p className="mt-5 text-sm text-ivory/70">{tx.installed}</p>;
  if (!prompt && !ios) return null;

  async function install() {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setPrompt(null);
    } else {
      setShowHint((v) => !v);
    }
  }

  return (
    <div className="mt-5" data-tg-hide>
      <button
        type="button"
        onClick={install}
        aria-expanded={prompt ? undefined : showHint}
        className="inline-flex items-center gap-2 rounded-full bg-ivory/10 px-4 py-2 text-sm font-semibold text-ivory hover:bg-ivory/20"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {tx.button}
      </button>
      {showHint ? <p className="mt-3 max-w-xs text-sm leading-relaxed text-ivory/75">{tx.iosHint}</p> : null}
    </div>
  );
}
