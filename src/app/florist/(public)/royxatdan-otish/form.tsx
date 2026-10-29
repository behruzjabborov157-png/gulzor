"use client";

import { useActionState } from "react";
import { registerFloristAction } from "@/app/florist/actions";
import { PhoneInput } from "@/components/ui/phone-input";
import { Alert } from "@/components/ui/primitives";
import type { FormState } from "@/lib/form-state";
import { submitWithoutReset } from "@/lib/use-form-submit";

export function FloristRegisterForm({ regions }: { regions: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerFloristAction, {});
  const err = (k: string) => state.errors?.[k];
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div>
      <label htmlFor={`r-${name}`} className="label">
        {label}
      </label>
      <input
        id={`r-${name}`}
        name={name}
        className="field"
        aria-invalid={!!err(name)}
        aria-describedby={err(name) ? `r-${name}-err` : undefined}
        {...props}
      />
      {err(name) ? (
        <p id={`r-${name}-err`} className="mt-1 text-sm text-danger">
          {err(name)}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-8" noValidate>
      {state.message && !state.ok ? <Alert tone="error">{state.message}</Alert> : null}

      <fieldset className="space-y-4">
        <legend className="mb-2 font-display text-2xl text-plum">Do‘kon</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("shopName", "Do‘kon nomi *", { required: true, maxLength: 80, autoComplete: "organization" })}
          <div>
            <label htmlFor="r-regionId" className="label">
              Shahar *
            </label>
            <select id="r-regionId" name="regionId" className="field" defaultValue={regions[0]?.id} aria-invalid={!!err("regionId")}>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {err("regionId") ? <p className="mt-1 text-sm text-danger">{err("regionId")}</p> : null}
          </div>
        </div>
        {field("address", "Do‘kon manzili *", { required: true, maxLength: 200, autoComplete: "street-address" })}
        <div>
          <label htmlFor="r-description" className="label">
            Do‘kon haqida qisqacha
          </label>
          <textarea id="r-description" name="description" rows={3} maxLength={1000} className="field" />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-display text-2xl text-plum">Tekshiruv uchun</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("legalName", "Yuridik nom *", { required: true, maxLength: 120 }, "YaTT yoki MChJ nomi, hujjatlardagidek")}
          {field("taxId", "STIR (INN) *", { required: true, inputMode: "numeric", maxLength: 11, pattern: "[0-9 ]{9,11}" }, "9 ta raqam")}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-display text-2xl text-plum">Aloqa va kirish</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("contactName", "Ismingiz *", { required: true, maxLength: 80, autoComplete: "name" })}
          <div>
            <label htmlFor="r-phone" className="label">
              Telefon *
            </label>
            <PhoneInput id="r-phone" name="phone" required aria-invalid={!!err("phone")} />
            {err("phone") ? <p className="mt-1 text-sm text-danger">{err("phone")}</p> : null}
          </div>
          {field("telegramUsername", "Telegram username", { maxLength: 64, placeholder: "dokon_nomi" })}
          {field("email", "Email (kirish uchun) *", { required: true, type: "email", autoComplete: "email" })}
          {field("password", "Parol *", { required: true, type: "password", minLength: 12, autoComplete: "new-password" }, "Kamida 12 belgi")}
        </div>
      </fieldset>

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="acceptTerms" className="mt-1 h-4 w-4 accent-wine" aria-invalid={!!err("acceptTerms")} />
          <span>
            Ma’lumotlarim to‘g‘ri ekanini tasdiqlayman. Gulzor ularni tekshirishi, har bir yetkazilgan buyurtmadan komissiya hisoblashi va buyurtmalarni
            o‘zim yetkazib berishim, mijoz to‘lovini o‘zim qabul qilishimga roziman.
          </span>
        </label>
        {err("acceptTerms") ? <p className="mt-1 text-sm text-danger">{err("acceptTerms")}</p> : null}
      </div>

      <button className="btn-primary w-full py-4 text-base sm:w-auto sm:px-10" disabled={pending}>
        {pending ? "Yuborilmoqda…" : "Ariza yuborish"}
      </button>
    </form>
  );
}
