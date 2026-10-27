"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/config";

/** Friendly error screen with a retry. Never shows technical details to visitors. */
export function ErrorView({ error, reset, homeHref }: { error: Error & { digest?: string }; reset: () => void; homeHref?: string }) {
  const { t: dict, href } = useT();
  const t = dict.common;
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page flex min-h-[50vh] flex-col items-center justify-center py-16 text-center" role="alert">
      <h1 className="text-4xl">{t.error.title}</h1>
      <p className="mt-3 max-w-md text-muted">{t.error.text}</p>
      {error.digest ? <p className="mt-2 text-xs text-muted">{fmt(t.error.code, { code: error.digest })}</p> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          {t.error.retry}
        </button>
        <Link href={homeHref ?? href("/")} className="btn-secondary">
          {t.home}
        </Link>
      </div>
    </div>
  );
}
