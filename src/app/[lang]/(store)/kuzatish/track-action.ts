"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { clientIp, rateLimit } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import { localePath } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { getLocale } from "@/i18n/server";

export async function trackAction(_: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const e = getDict(locale).errors.form;
  const number = String(form.get("number") ?? "").trim().toUpperCase();
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  if (!number || !phone) return { message: e.trackRequired };
  if (!(await rateLimit(`track:${await clientIp()}`, 10, 900))) return { message: e.tooMany15 };

  const db = await getDb();
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.number, number));
  // Only the buyer's phone works (the recipient must not learn who sent an anonymous gift).
  // Same message whether the order is missing or the phone does not match.
  if (!o || o.customerPhone !== phone) {
    return { message: e.trackNotFound };
  }
  redirect(localePath(locale, `/buyurtma/${o.number}?t=${o.accessToken}`));
}
