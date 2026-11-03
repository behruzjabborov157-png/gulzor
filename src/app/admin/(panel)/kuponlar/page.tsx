import { panelT } from "@/i18n/panel/server";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { saveCouponAction } from "@/app/admin/actions";
import { AdminForm, C, F } from "@/components/admin/admin-form";
import { requireOwner } from "@/lib/auth";

export async function generateMetadata() {
  return { title: (await panelT())("Promokodlar") };
}

type Coupon = typeof schema.coupons.$inferSelect;
const d = (v: Date | null) => (v ? new Date(v.getTime() + 5 * 3600_000).toISOString().slice(0, 10) : "");

async function Fields({ c }: { c?: Coupon }) {
  const tt = await panelT();
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <F label={tt("Kod *")} name="code" defaultValue={c?.code} required />
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{tt("Turi")}</label>
        <select name="type" defaultValue={c?.type ?? "percent"} className="field px-3 py-2" aria-label={tt("Turi")}>
          <option value="percent">{tt("Foiz, %")}</option>
          <option value="fixed">{tt("Summa, so‘m")}</option>
        </select>
      </div>
      <F label={tt("Qiymat *")} name="value" defaultValue={c?.value} inputMode="numeric" required />
      <F label={tt("Minimal summa")} name="minSubtotal" defaultValue={c?.minSubtotal ?? 0} inputMode="numeric" />
      <F label={tt("Maks. chegirma")} name="maxDiscount" defaultValue={c?.maxDiscount} inputMode="numeric" />
      <F label={tt("Foydalanish limiti")} name="usageLimit" defaultValue={c?.usageLimit} inputMode="numeric" />
      <F label={tt("Boshlanish")} name="startsAt" type="date" defaultValue={d(c?.startsAt ?? null)} />
      <F label={tt("Tugash")} name="endsAt" type="date" defaultValue={d(c?.endsAt ?? null)} />
      <div className="flex items-end pb-2"><C label={tt("Faol")} name="isActive" defaultChecked={c?.isActive ?? true} /></div>
    </div>
  );
}

export default async function CouponsAdmin() {
  const tt = await panelT();
  await requireOwner();
  const db = await getDb();
  const rows = await db.select().from(schema.coupons).orderBy(desc(schema.coupons.createdAt));
  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-4xl">{tt("Promokodlar")}</h1>
      <p className="text-sm text-muted">{tt("Chegirma faqat haqiqiy bo‘lsin: promokod summasi buyurtma yakuniy narxidan server tomonida ayiriladi.")}</p>
      <section className="card p-5">
        <h2 className="mb-3 text-2xl">{tt("Yangi promokod")}</h2>
        <AdminForm action={saveCouponAction.bind(null, null)} submitLabel={tt("Qo‘shish")} resetOnSuccess><Fields /></AdminForm>
      </section>
      {rows.map((c) => (
        <details key={c.id} className="card">
          <summary className="flex cursor-pointer flex-wrap justify-between gap-2 px-5 py-3 text-sm">
            <span><strong>{c.code}</strong> · {c.type === "percent" ? `${c.value}%` : `${c.value} so‘m`}{" "}{tt("· ishlatilgan")}{" "}{c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ""}{c.isActive ? "" : tt(" · o‘chirilgan")}</span>
            <span className="text-xs text-wine">{tt("Tahrirlash")}</span>
          </summary>
          <div className="border-t border-line p-5"><AdminForm action={saveCouponAction.bind(null, c.id)}><Fields c={c} /></AdminForm></div>
        </details>
      ))}
    </div>
  );
}
