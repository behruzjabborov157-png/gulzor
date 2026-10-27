"use client";

import { PhoneInput } from "@/components/ui/phone-input";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { useActionState, useState } from "react";
import { loginAction, registerAction } from "@/app/actions";
import { Alert } from "@/components/ui/primitives";
import type { FormState } from "@/lib/form-state";

export function AuthForms({ next }: { next: string }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loginState, login, loggingIn] = useActionState<FormState, FormData>(loginAction, {});
  const [regState, register, registering] = useActionState<FormState, FormData>(registerAction, {});

  return (
    <div className="card mt-8 p-6">
      <div role="tablist" className="mb-6 grid grid-cols-2 rounded-full bg-ivory-deep p-1 text-sm font-semibold">
        {(["login", "register"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full py-2 ${tab === t ? "bg-white shadow-sm" : "text-muted"}`}>
            {t === "login" ? "Kirish" : "Ro‘yxatdan o‘tish"}
          </button>
        ))}
      </div>
      {tab === "login" ? (
        <form onSubmit={submitWithoutReset(login)} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          {loginState.message ? <Alert tone="error">{loginState.message}</Alert> : null}
          <div>
            <label htmlFor="l-phone" className="label">Telefon raqami</label>
            <PhoneInput id="l-phone" name="phone" required />
          </div>
          <div>
            <label htmlFor="l-pass" className="label">Parol</label>
            <input id="l-pass" name="password" type="password" autoComplete="current-password" className="field" required />
          </div>
          <button className="btn-primary w-full" disabled={loggingIn}>{loggingIn ? "Tekshirilmoqda…" : "Kirish"}</button>
        </form>
      ) : (
        <form onSubmit={submitWithoutReset(register)} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          {regState.message ? <Alert tone="error">{regState.message}</Alert> : null}
          <div>
            <label htmlFor="r-name" className="label">Ismingiz</label>
            <input id="r-name" name="name" autoComplete="name" className="field" aria-invalid={!!regState.errors?.name} required />
            {regState.errors?.name ? <p className="mt-1 text-sm text-danger">{regState.errors.name}</p> : null}
          </div>
          <div>
            <label htmlFor="r-phone" className="label">Telefon raqami</label>
            <PhoneInput id="r-phone" name="phone" aria-invalid={!!regState.errors?.phone} required />
            {regState.errors?.phone ? <p className="mt-1 text-sm text-danger">{regState.errors.phone}</p> : null}
          </div>
          <div>
            <label htmlFor="r-pass" className="label">Parol</label>
            <input id="r-pass" name="password" type="password" autoComplete="new-password" minLength={8} className="field" aria-invalid={!!regState.errors?.password} required />
            {regState.errors?.password ? <p className="mt-1 text-sm text-danger">{regState.errors.password}</p> : <p className="mt-1 text-xs text-muted">Kamida 8 belgi</p>}
          </div>
          <button className="btn-primary w-full" disabled={registering}>{registering ? "Saqlanmoqda…" : "Hisob yaratish"}</button>
        </form>
      )}
    </div>
  );
}
