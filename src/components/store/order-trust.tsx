"use client";

import { useActionState, useState } from "react";
import { disputeAction, reviewAction } from "@/app/actions";
import { fmt } from "@/i18n/config";
import { useT } from "@/i18n/client";
import type { FormState } from "@/lib/form-state";
import { submitWithoutReset } from "@/lib/use-form-submit";

const REASONS = ["late", "quality", "wrong_item", "not_delivered", "other"] as const;

/** Star rating + optional text; only rendered for a delivered order without a review. */
export function ReviewForm({ number, token }: { number: string; token: string }) {
  const { t: dict } = useT();
  const t = dict.order.trust;
  const [state, action, pending] = useActionState<FormState, FormData>(reviewAction.bind(null, number, token), {});
  const [rating, setRating] = useState(0);
  if (state.ok) return <p role="status" className="text-success">{state.message}</p>;
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-4">
      <fieldset>
        <legend className="label">{t.rating}</legend>
        <div className="flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-md p-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-wine">
              <input type="radio" name="rating" value={n} className="sr-only" checked={rating === n} onChange={() => setRating(n)} aria-label={fmt(t.stars, { n })} />
              <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" className={n <= rating ? "text-coral" : "text-line"}>
                <path fill="currentColor" d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" />
              </svg>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="review-text" className="label">
          {t.reviewText}
        </label>
        <textarea id="review-text" name="text" rows={3} maxLength={1000} className="field" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary btn-sm" disabled={pending}>
          {t.reviewSend}
        </button>
        {state.message ? (
          <span role="alert" className="text-sm text-danger">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function DisputeForm({ number, token }: { number: string; token: string }) {
  const { t: dict } = useT();
  const t = dict.order.trust;
  const [state, action, pending] = useActionState<FormState, FormData>(disputeAction.bind(null, number, token), {});
  if (state.ok) return <p role="status" className="text-success">{state.message}</p>;
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-4">
      <div>
        <label htmlFor="dispute-reason" className="label">
          {t.reason}
        </label>
        <select id="dispute-reason" name="reason" required defaultValue="" className="field py-2.5">
          <option value="" disabled>
            —
          </option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {t.reasons[r]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="dispute-message" className="label">
          {t.message}
        </label>
        <textarea id="dispute-message" name="message" required minLength={10} rows={4} maxLength={2000} className="field" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-secondary btn-sm" disabled={pending}>
          {t.disputeOpen}
        </button>
        {state.message ? (
          <span role="alert" className="text-sm text-danger">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
