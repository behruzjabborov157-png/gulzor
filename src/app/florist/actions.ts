"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIp, createSession, destroySession, rateLimit, requireFlorist } from "@/lib/auth";
import { notifyCustomerTelegram } from "@/lib/customer-telegram";
import { audit } from "@/lib/florists";
import {
  floristChangeStatus,
  floristMarkCashPaid,
  profileFromForm,
  registerFlorist,
  saveFloristZone,
  updateFloristProfile,
  type FloristApplication,
} from "@/lib/florist-panel";
import type { FormState } from "@/lib/form-state";
import type { Order } from "@/lib/orders";
import { formInt, saveProductForm } from "@/lib/product-save";
import { notifyFloristApplication } from "@/lib/telegram";
import { unlinkFloristChat } from "@/lib/florist-notify";
import { UploadError } from "@/lib/storage";
import { addOrderPhoto, floristDisputeNote, replyToReview } from "@/lib/trust";

/*
 * Florist panel actions. The florist id always comes from the signed-in session (requireFlorist),
 * and every function in lib/florist-panel.ts re-checks that the record belongs to that florist.
 */

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

/** Public "open a shop" form (/florist/royxatdan-otish). The owner gets a Telegram note. */
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
  after(async () => {
    await audit({ id: res.userId, email: application.email.trim().toLowerCase() }, "florist.registered", "florist", res.floristId);
    await notifyFloristApplication(res.floristId, application.shopName.trim());
  });
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
  const res = await updateFloristProfile(me.floristId, profileFromForm(form));
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath("/florist/profil");
  return { ok: true, message: "Saqlandi" };
}

export async function floristUnlinkTelegramAction() {
  const me = await requireFlorist();
  await unlinkFloristChat(me.floristId);
  revalidatePath("/florist/profil");
}

/** Photo of the prepared bouquet; the customer sees it on the order page. */
export async function floristOrderPhotoAction(orderId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireFlorist();
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Rasmni tanlang" };
  try {
    const res = await addOrderPhoto(orderId, file, me.email, me.floristId);
    if (!res.ok) return res;
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, message: e.message };
    throw e;
  }
  revalidatePath(`/florist/buyurtmalar/${orderId}`);
  return { ok: true, message: "Rasm yuklandi — mijoz uni buyurtma sahifasida ko‘radi" };
}

export async function floristDisputeNoteAction(disputeId: number, orderId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireFlorist();
  const res = await floristDisputeNote(me.floristId, disputeId, text(form, "note"));
  if (!res.ok) return res;
  revalidatePath(`/florist/buyurtmalar/${orderId}`);
  return { ok: true, message: "Izohingiz Gulzor’ga yuborildi" };
}

export async function floristReviewReplyAction(reviewId: number, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireFlorist();
  const res = await replyToReview(me.floristId, reviewId, text(form, "reply"));
  if (!res.ok) return res;
  revalidatePath("/florist/sharhlar");
  return { ok: true, message: "Javob saqlandi" };
}
