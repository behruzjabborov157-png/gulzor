"use client";

import { usePanelT } from "@/i18n/panel/client";
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
  const tt = usePanelT();
  const [state, action, pending] = useActionState<FormState, FormData>(updateOrderDeliveryAction.bind(null, orderId), {});
  const input = (name: keyof Values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`d-${name}`} className="label">{label}</label>
      <input id={`d-${name}`} name={name} defaultValue={String(values[name])} className="field py-2" {...props} />
    </div>
  );
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-3">
      {state.message ? <Alert tone={state.ok ? "success" : "error"}>{tt(state.message)}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {input("deliveryDate", tt("Sana"), { type: "date" })}
        <div>
          <label htmlFor="d-slot" className="label">{tt("Vaqt")}</label>
          <select id="d-slot" name="slotId" defaultValue={values.slotId} className="field py-2">
            {slots.map((s) => <option key={s.id} value={s.id}>{tt(s.label)}</option>)}
          </select>
        </div>
        {input("recipientName", tt("Qabul qiluvchi"))}
        {input("recipientPhone", tt("Telefon"))}
        {input("district", tt("Tuman"))}
        {input("neighborhood", tt("Mahalla"))}
        {input("address", tt("Manzil"))}
        {input("apartment", tt("Xonadon"))}
      </div>
      {input("landmark", tt("Mo‘ljal"))}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="d-courier" className="label">{tt("Kuryer uchun izoh")}</label>
          <textarea id="d-courier" name="courierNote" defaultValue={values.courierNote} className="field min-h-20" />
        </div>
        <div>
          <label htmlFor="d-admin" className="label">{tt("Ichki izoh (mijozga ko‘rinmaydi)")}</label>
          <textarea id="d-admin" name="adminNote" defaultValue={values.adminNote} className="field min-h-20" />
        </div>
      </div>
      <button className="btn-primary btn-sm" disabled={pending}>{pending ? tt("Saqlanmoqda…") : tt("Saqlash")}</button>
    </form>
  );
}
