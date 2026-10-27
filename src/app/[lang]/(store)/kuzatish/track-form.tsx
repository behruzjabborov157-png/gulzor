"use client";

import { PhoneInput } from "@/components/ui/phone-input";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { useActionState } from "react";
import { Alert } from "@/components/ui/primitives";
import type { FormState } from "@/lib/form-state";
import { useT } from "@/i18n/client";
import { trackAction } from "./track-action";

export function TrackForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(trackAction, {});
  const t = useT().t.order;
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-4">
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <div>
        <label htmlFor="number" className="label">{t.trackNumber}</label>
        <input id="number" name="number" className="field uppercase" placeholder="GZ-261026-1234" required maxLength={30} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="phone" className="label">{t.trackPhone}</label>
        <PhoneInput id="phone" name="phone" required />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? t.trackSearching : t.trackSubmit}</button>
    </form>
  );
}
