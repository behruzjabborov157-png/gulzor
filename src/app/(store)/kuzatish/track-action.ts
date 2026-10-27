"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { clientIp, rateLimit } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import type { FormState } from "@/lib/form-state";

export async function trackAction(_: FormState, form: FormData): Promise<FormState> {
  const number = String(form.get("number") ?? "").trim().toUpperCase();
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  if (!number || !phone) return { message: "Buyurtma raqami va telefonni to‘g‘ri kiriting" };
  if (!(await rateLimit(`track:${await clientIp()}`, 10, 900))) return { message: "Juda ko‘p urinish. 15 daqiqadan so‘ng qayta urinib ko‘ring." };

  const db = await getDb();
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.number, number));
  // Only the buyer's phone works (the recipient must not learn who sent an anonymous gift).
  // Same message whether the order is missing or the phone does not match.
  if (!o || o.customerPhone !== phone) {
    return { message: "Bunday buyurtma topilmadi. Raqamlarni tekshiring." };
  }
  redirect(`/buyurtma/${o.number}?t=${o.accessToken}`);
}
