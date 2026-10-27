"use client";

import { submitWithoutReset } from "@/lib/use-form-submit";
import { useActionState, useEffect, useId, useRef } from "react";
import type { FormState } from "@/lib/form-state";

/** Wraps a bound server action with pending state and a result message. */
export function AdminForm({
  action,
  children,
  submitLabel = "Saqlash",
  className = "",
  resetOnSuccess = false,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  /** Clear the fields after a successful save (for “add new” forms). */
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} onSubmit={submitWithoutReset(formAction)} className={className}>
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className="btn-primary btn-sm" disabled={pending}>{pending ? "Saqlanmoqda…" : submitLabel}</button>
        {state.message ? (
          <span role="status" className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}

export function F({ label, name, defaultValue, ...rest }: { label: string; name: string; defaultValue?: string | number | null } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <input id={id} name={name} defaultValue={defaultValue ?? ""} className="field px-3 py-2" {...rest} />
    </div>
  );
}

export function C({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-forest" /> {label}
    </label>
  );
}
