"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Friendly error screen with a retry. Never shows technical details to visitors. */
export function ErrorView({ error, reset, homeHref = "/" }: { error: Error & { digest?: string }; reset: () => void; homeHref?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page flex min-h-[50vh] flex-col items-center justify-center py-16 text-center" role="alert">
      <h1 className="text-4xl">Nimadir noto‘g‘ri ketdi</h1>
      <p className="mt-3 max-w-md text-muted">
        Sahifani yuklashda xatolik yuz berdi. Qayta urinib ko‘ring — muammo davom etsa, birozdan so‘ng qayting.
      </p>
      {error.digest ? <p className="mt-2 text-xs text-muted">Xato kodi: {error.digest}</p> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Qayta urinish
        </button>
        <Link href={homeHref} className="btn-secondary">
          Bosh sahifa
        </Link>
      </div>
    </div>
  );
}
