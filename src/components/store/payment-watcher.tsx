"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** While a payment is unconfirmed, re-reads the order so the page updates when the provider's confirmation arrives. */
export function PaymentWatcher({ everyMs = 5000, tries = 36 }: { everyMs?: number; tries?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      if (++n >= tries) clearInterval(id);
      if (!document.hidden) router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs, tries]);
  return null;
}
