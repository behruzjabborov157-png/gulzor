"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIp, createSession, destroySession, rateLimit, requireFlorist } from "@/lib/auth";
import { notifyCustomerTelegram } from "@/lib/customer-telegram";
import {
  floristChangeStatus,
  floristMarkCashPaid,
  registerFlorist,
  saveFloristZone,
  updateFloristProfile,
  type FloristApplication,
} from "@/lib/florist-panel";
import type { FormState } from "@/lib/form-state";
import type { Order } from "@/lib/orders";
import { formInt, saveProductForm } from "@/lib/product-save";

/*
 * Florist panel actions. The florist id always comes from the signed-in session (requireFlorist),
 * and every function in lib/florist-panel.ts re-checks that the record belongs to that florist.
 */

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

/** Public "open a shop" form (/florist/royxatdan-otish). */
export async function registerFloristAction(_: FormState, form: FormData): Promise<FormState> {
  if (!(await rateLimit(`florist-register:${await clientIp()}`, 5, 3600))) {
    return { ok: false, message: "Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring." };
  }
  const application: FloristApplication = {
    shopName: text(form, "shopName"),
    contactName: text(form, "contactName"),
    email: text(form, "email"),
    password: text(form, "password"),
    phone: text(form, "phone"),
    telegramUsername: text(form, "telegramUsername"),
    regionId: formInt(form.get("regionId")) || null,
    address: text(form, "address"),
    legalName: text(form, "legalName"),
    taxId: text(form, "taxId").replace(/\s/g, ""),
    description: text(form, "description"),
    acceptTerms: form.get("acceptTerms") === "on",
  };
  const res = await registerFlorist(application);
  if (!res.ok) return { ok: false, errors: res.errors, message: "Xatolarni to‘g‘rilang" };
  await createSession("admin", res.userId);
  redirect("/florist?yangi=1");
}

export async function floristLogoutAction() {
  await destroySession("admin");
  redirect("/admin/kirish");
}

export async function floristSaveProductAction(productId: number | null, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireFlorist();
  const { state, id } = await saveProductForm({ kind: "florist", floristId: me.floristId }, productId, form);
  if (!state.ok) return state;
  revalidatePath("/florist/mahsulotlar");
  if (!productId) redirect(`/florist/mahsulotlar/${id}?saqlandi=1`);
  return state;
}

const STATUSES = ["new", "confirmed", "preparing", "ready", "dispatched", "delivered", "cancelled", "rejected"] as const;

export async function floristOrderStatusAction(orderId: string, to: Order["status"], _: FormState, form: FormData): Promise<FormState> {
  const me = await requireFlorist();
  if (!(STATUSES as readonly string[]).includes(to)) return { ok: false, message: "Noto‘g‘ri holat" };
  const res = await floristChangeStatus(me.floristId, me.email, orderId, to, text(form, "reason"));
  if (!res.ok) return { ok: false, message: res.message };
  // Mini App / bot customers get the new status in Telegram.
  after(() => notifyCustomerTelegram(orderId, "status"));
  revalidatePath(`/florist/buyurtmalar/${orderId}`);
  return { ok: true, message: "Saqlandi" };
}

export async function floristCashPaidAction(orderId: string): Promise<FormState> {
  const me = await requireFlorist();
  const res = await floristMarkCashPaid(me.floristId, me.email, orderId);
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath(`/florist/buyurtmalar/${orderId}`);
  return { ok: true, message: "Saqlandi" };
}

export async function floristSaveZoneAction(zoneId: number | null, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireFlorist();
  const num = (k: string) => formInt(form.get(k));
  const res = await saveFloristZone(me.floristId, zoneId, {
    regionId: num("regionId") ?? 0,
    name: text(form, "name"),
    nameRu: text(form, "nameRu") || null,
    description: text(form, "description"),
    fee: num("fee") ?? -1,
    freeFrom: num("freeFrom"),
    minOrder: num("minOrder"),
    sameDayEnabled: form.get("sameDayEnabled") === "on",
    sameDayCutoff: text(form, "sameDayCutoff") || "18:00",
    minLeadMinutes: z.number().int().min(0).max(10_080).catch(120).parse(num("minLeadMinutes")),
    isActive: form.get("isActive") === "on",
  });
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath("/florist/hududlar");
  return { ok: true, message: "Saqlandi" };
}

export async function floristSaveProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireFlorist();
  const res = await updateFloristProfile(me.floristId, {
    name: text(form, "name"),
    nameRu: text(form, "nameRu") || null,
    description: text(form, "description"),
    descriptionRu: text(form, "descriptionRu") || null,
    phone: text(form, "phone"),
    telegramUsername: text(form, "telegramUsername"),
    address: text(form, "address"),
    addressRu: text(form, "addressRu") || null,
  });
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath("/florist/profil");
  return { ok: true, message: "Saqlandi" };
}
