import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { saveCouponAction } from "@/app/admin/actions";
import { AdminForm, C, F } from "@/components/admin/admin-form";
import { requireOwner } from "@/lib/auth";

export const metadata = { title: "Promokodlar" };

type Coupon = typeof schema.coupons.$inferSelect;
const d = (v: Date | null) => (v ? new Date(v.getTime() + 5 * 3600_000).toISOString().slice(0, 10) : "");

function Fields({ c }: { c?: Coupon }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <F label="Kod *" name="code" defaultValue={c?.code} required />
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Turi</label>
        <select name="type" defaultValue={c?.type ?? "percent"} className="field px-3 py-2" aria-label="Turi">
          <option value="percent">Foiz, %</option>
          <option value="fixed">Summa, so‘m</option>
        </select>
      </div>
      <F label="Qiymat *" name="value" defaultValue={c?.value} inputMode="numeric" required />
      <F label="Minimal summa" name="minSubtotal" defaultValue={c?.minSubtotal ?? 0} inputMode="numeric" />
      <F label="Maks. chegirma" name="maxDiscount" defaultValue={c?.maxDiscount} inputMode="numeric" />
      <F label="Foydalanish limiti" name="usageLimit" defaultValue={c?.usageLimit} inputMode="numeric" />
      <F label="Boshlanish" name="startsAt" type="date" defaultValue={d(c?.startsAt ?? null)} />
      <F label="Tugash" name="endsAt" type="date" defaultValue={d(c?.endsAt ?? null)} />
      <div className="flex items-end pb-2"><C label="Faol" name="isActive" defaultChecked={c?.isActive ?? true} /></div>
    </div>
  );
}

export default async function CouponsAdmin() {
  await requireOwner();
  const db = await getDb();
  const rows = await db.select().from(schema.coupons).orderBy(desc(schema.coupons.createdAt));
  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-4xl">Promokodlar</h1>
      <p className="text-sm text-muted">Chegirma faqat haqiqiy bo‘lsin: promokod summasi buyurtma yakuniy narxidan server tomonida ayiriladi.</p>
      <section className="card p-5">
        <h2 className="mb-3 text-2xl">Yangi promokod</h2>
        <AdminForm action={saveCouponAction.bind(null, null)} submitLabel="Qo‘shish" resetOnSuccess><Fields /></AdminForm>
      </section>
      {rows.map((c) => (
        <details key={c.id} className="card">
          <summary className="flex cursor-pointer flex-wrap justify-between gap-2 px-5 py-3 text-sm">
            <span><strong>{c.code}</strong> · {c.type === "percent" ? `${c.value}%` : `${c.value} so‘m`} · ishlatilgan {c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ""}{c.isActive ? "" : " · o‘chirilgan"}</span>
            <span className="text-xs text-forest">Tahrirlash</span>
          </summary>
          <div className="border-t border-line p-5"><AdminForm action={saveCouponAction.bind(null, c.id)}><Fields c={c} /></AdminForm></div>
        </details>
      ))}
    </div>
  );
}
