"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "@/app/actions";
import { Alert } from "@/components/ui/primitives";
import { useT } from "@/i18n/client";
import type { FormState } from "@/lib/form-state";
import { submitWithoutReset } from "@/lib/use-form-submit";

export function DeleteAccountForm({ signedInAs }: { signedInAs: string }) {
  const t = useT().t.account.deleteAccount;
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccountAction, {});
  return (
    <form onSubmit={submitWithoutReset(action)} className="card space-y-4 border-danger/30 p-6">
      <p className="font-semibold">{signedInAs}</p>
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <div>
        <label htmlFor="del-pass" className="label">
          {t.password}
        </label>
        <input
          id="del-pass"
          name="password"
          type="password"
          autoComplete="current-password"
          className="field"
          aria-invalid={!!state.errors?.password}
          aria-describedby={state.errors?.password ? "del-pass-err" : undefined}
          required
        />
        {state.errors?.password ? (
          <p id="del-pass-err" className="mt-1 text-sm text-danger">
            {state.errors.password}
          </p>
        ) : null}
      </div>
      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="confirm" className="mt-1" required aria-invalid={!!state.errors?.confirm} />
          <span>{t.confirm}</span>
        </label>
        {state.errors?.confirm ? <p className="mt-1 text-sm text-danger">{state.errors.confirm}</p> : null}
      </div>
      <button className="btn w-full rounded-full bg-danger px-6 py-3 font-semibold text-white hover:bg-danger/90 disabled:opacity-60" disabled={pending}>
        {pending ? t.deleting : t.submit}
      </button>
    </form>
  );
}
