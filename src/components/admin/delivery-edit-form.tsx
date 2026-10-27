"use client";

import { submitWithoutReset } from "@/lib/use-form-submit";
import { useActionState } from "react";
import { updateOrderDeliveryAction } from "@/app/admin/actions";
import { Alert } from "@/components/ui/primitives";
import type { FormState } from "@/lib/form-state";

type Values = {
  deliveryDate: string;
  slotId: number;
  recipientName: string;
  recipientPhone: string;
  district: string;
  neighborhood: string;
  address: string;
  apartment: string;
  landmark: string;
  courierNote: string;
  adminNote: string;
};

export function DeliveryEditForm({ orderId, values, slots }: { orderId: string; values: Values; slots: { id: number; label: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateOrderDeliveryAction.bind(null, orderId), {});
  const input = (name: keyof Values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`d-${name}`} className="label">{label}</label>
      <input id={`d-${name}`} name={name} defaultValue={String(values[name])} className="field py-2" {...props} />
    </div>
  );
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-3">
      {state.message ? <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {input("deliveryDate", "Sana", { type: "date" })}
        <div>
          <label htmlFor="d-slot" className="label">Vaqt</label>
          <select id="d-slot" name="slotId" defaultValue={values.slotId} className="field py-2">
            {slots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        {input("recipientName", "Qabul qiluvchi")}
        {input("recipientPhone", "Telefon")}
        {input("district", "Tuman")}
        {input("neighborhood", "Mahalla")}
        {input("address", "Manzil")}
        {input("apartment", "Xonadon")}
      </div>
      {input("landmark", "Mo‘ljal")}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="d-courier" className="label">Kuryer uchun izoh</label>
          <textarea id="d-courier" name="courierNote" defaultValue={values.courierNote} className="field min-h-20" />
        </div>
        <div>
          <label htmlFor="d-admin" className="label">Ichki izoh (mijozga ko‘rinmaydi)</label>
          <textarea id="d-admin" name="adminNote" defaultValue={values.adminNote} className="field min-h-20" />
        </div>
      </div>
      <button className="btn-primary btn-sm" disabled={pending}>{pending ? "Saqlanmoqda…" : "Saqlash"}</button>
    </form>
  );
}
