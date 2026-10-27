"use client";

import { useState } from "react";
import { retryPaymentAction } from "@/app/actions";

export function RetryPayment({ number, token }: { number: string; token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!token) return null;
  return (
    <>
      <button
        type="button"
        className="btn-primary btn-sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const url = await retryPaymentAction(number, token);
          if (url) window.location.assign(url);
          else {
            setError("To‘lov havolasini yaratib bo‘lmadi. Do‘kon bilan bog‘laning.");
            setPending(false);
          }
        }}
      >
        {pending ? "Ochilmoqda…" : "To‘lovni davom ettirish"}
      </button>
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </>
  );
}
