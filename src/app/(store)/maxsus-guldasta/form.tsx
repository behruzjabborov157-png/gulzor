"use client";

import { PhoneInput } from "@/components/ui/phone-input";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { useActionState } from "react";
import { customRequestAction } from "@/app/actions";
import { Alert } from "@/components/ui/primitives";
import type { FormState } from "@/lib/form-state";

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="mt-1 text-sm text-danger">
      {error}
    </p>
  ) : null;
}

export function CustomRequestForm({ occasions, minDate, maxDate }: { occasions: string[]; minDate: string; maxDate: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(customRequestAction, {});
  if (state.ok) return <Alert tone="success">{state.message}</Alert>;
  const err = (k: string) => state.errors?.[k];
  const a = (k: string) => ({ id: k, name: k, "aria-invalid": !!err(k), "aria-describedby": err(k) ? `${k}-err` : undefined });

  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-4" noValidate>
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">Ismingiz *</label>
          <input {...a("name")} className="field" autoComplete="name" maxLength={80} required />
          <FieldError id="name-err" error={err("name")} />
        </div>
        <div>
          <label htmlFor="phone" className="label">Telefon *</label>
          <PhoneInput {...a("phone")} required />
          <FieldError id="phone-err" error={err("phone")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="occasion" className="label">Munosabat</label>
          <select {...a("occasion")} className="field" defaultValue="">
            <option value="">Tanlang…</option>
            {occasions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="budget" className="label">Byudjet (so‘m)</label>
          <input {...a("budget")} inputMode="numeric" className="field" placeholder="500 000" />
        </div>
        <div>
          <label htmlFor="date" className="label">Kerakli sana</label>
          <input {...a("date")} type="date" min={minDate} max={maxDate} className="field" />
          <FieldError id="date-err" error={err("date")} />
        </div>
      </div>
      <div>
        <label htmlFor="colors" className="label">Rang istaklari</label>
        <input {...a("colors")} className="field" placeholder="Masalan: oq va och pushti, yashilsiz" maxLength={120} />
      </div>
      <div>
        <label htmlFor="description" className="label">Qanday guldasta xohlaysiz? *</label>
        <textarea {...a("description")} className="field min-h-32" maxLength={2000} placeholder="Gullar, o‘lcham, uslub va boshqa istaklar" required />
        <FieldError id="description-err" error={err("description")} />
      </div>
      <div>
        <label htmlFor="image" className="label">Namunaviy rasm (ixtiyoriy)</label>
        <input {...a("image")} type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-forest/10 file:px-4 file:py-2 file:text-forest" />
        <p className="mt-1 text-xs text-muted">JPG, PNG yoki WEBP, 6 MB gacha. Rasm faqat floristlarimizga ko‘rinadi.</p>
        <FieldError id="image-err" error={err("image")} />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Yuborilmoqda…" : "So‘rov yuborish"}</button>
    </form>
  );
}
