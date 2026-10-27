"use client";

import { useState } from "react";
import { retryPaymentAction } from "@/app/actions";
import { useT } from "@/i18n/client";

export function RetryPayment({ number, token }: { number: string; token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT().t.order;
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
            setError(t.retryFailed);
            setPending(false);
          }
        }}
      >
        {pending ? t.retryOpening : t.retryPayment}
      </button>
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </>
  );
}
