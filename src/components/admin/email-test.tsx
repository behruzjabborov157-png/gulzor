"use client";

import { useActionState } from "react";
import { testEmailAction } from "@/app/admin/actions";
import type { FormState } from "@/lib/form-state";

export function EmailTest() {
  const [state, action, pending] = useActionState<FormState, FormData>(async () => testEmailAction(), {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <button className="btn-secondary btn-sm" disabled={pending}>{pending ? "Yuborilmoqda…" : "Test email yuborish"}</button>
      {state.message ? <span role="status" className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</span> : null}
    </form>
  );
}
