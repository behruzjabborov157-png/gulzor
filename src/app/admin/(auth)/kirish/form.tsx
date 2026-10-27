"use client";

import { submitWithoutReset } from "@/lib/use-form-submit";
import { useActionState } from "react";
import { adminLoginAction } from "@/app/admin/actions";
import { Alert } from "@/components/ui/primitives";
import type { FormState } from "@/lib/form-state";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(adminLoginAction, {});
  return (
    <form onSubmit={submitWithoutReset(action)} className="mt-6 space-y-4">
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" className="field" required />
      </div>
      <div>
        <label htmlFor="password" className="label">Parol</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="field" required />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Tekshirilmoqda…" : "Kirish"}</button>
    </form>
  );
}
