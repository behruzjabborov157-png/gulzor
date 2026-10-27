import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { saveRegionAction, saveSlotAction, saveZoneAction } from "@/app/admin/actions";
import { AdminForm, C, F } from "@/components/admin/admin-form";
import { requireOwner } from "@/lib/auth";
import { formatUZS } from "@/lib/format";

export const metadata = { title: "Yetkazib berish" };

type Zone = typeof schema.deliveryZones.$inferSelect;

function ZoneFields({ z, regionId }: { z?: Zone; regionId: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="regionId" value={regionId} />
      <F label="Hudud nomi *" name="name" defaultValue={z?.name} required />
      <F label="Yetkazish narxi, so‘m *" name="fee" defaultValue={z?.fee ?? ""} inputMode="numeric" required />
      <F label="Bepul yetkazish (dan), so‘m" name="freeFrom" defaultValue={z?.freeFrom} inputMode="numeric" placeholder="yo‘q" />
      <F label="Minimal buyurtma, so‘m" name="minOrder" defaultValue={z?.minOrder} inputMode="numeric" placeholder="yo‘q" />
      <div className="sm:col-span-2"><F label="Qamrab olingan tumanlar (mijozga ko‘rinadi)" name="description" defaultValue={z?.description} /></div>
      <F label="Shu kunga buyurtma qabuli (gacha), SS:DD" name="sameDayCutoff" defaultValue={z?.sameDayCutoff ?? "18:00"} pattern="[0-2][0-9]:[0-5][0-9]" />
      <F label="Minimal oldindan vaqt (daqiqa)" name="minLeadMinutes" defaultValue={z?.minLeadMinutes ?? 120} inputMode="numeric" />
      <F label="Tartib" name="sortOrder" defaultValue={z?.sortOrder ?? 0} inputMode="numeric" />
      <div className="flex flex-wrap items-end gap-4 pb-2 sm:col-span-3">
        <C label="Shu kuni yetkazish mumkin" name="sameDayEnabled" defaultChecked={z?.sameDayEnabled ?? true} />
        <C label="Faol" name="isActive" defaultChecked={z?.isActive ?? true} />
      </div>
    </div>
  );
}

export default async function DeliveryAdmin() {
  await requireOwner();
  const db = await getDb();
  const [regions, zones, slots] = await Promise.all([
    db.select().from(schema.deliveryRegions).orderBy(asc(schema.deliveryRegions.sortOrder)),
    db.select().from(schema.deliveryZones).orderBy(asc(schema.deliveryZones.sortOrder)),
    db.select().from(schema.timeSlots).orderBy(asc(schema.timeSlots.sortOrder), asc(schema.timeSlots.startTime)),
  ]);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-4xl">Yetkazib berish</h1>
        <p className="mt-2 text-sm text-muted">
          Faqat haqiqatan xizmat ko‘rsatadigan hududlarni faol qiling. Mijozlar faqat faol hududlarni ko‘radi; boshqa manzillar uchun ularga aloqa havolasi ko‘rsatiladi.
        </p>
      </div>

      {regions.map((r) => (
        <section key={r.id} className="card p-5">
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span className="text-2xl font-display">{r.name} {r.isActive ? "" : <span className="font-sans text-sm text-muted">(o‘chirilgan)</span>}</span>
              <span className="text-xs text-forest">Shahar/viloyatni tahrirlash</span>
            </summary>
            <div className="mt-3">
              <AdminForm action={saveRegionAction.bind(null, r.id)}>
                <div className="grid gap-3 sm:grid-cols-4">
                  <F label="Nomi" name="name" defaultValue={r.name} />
                  <F label="Slug" name="slug" defaultValue={r.slug} />
                  <F label="Tartib" name="sortOrder" defaultValue={r.sortOrder} />
                  <div className="flex items-end pb-2"><C label="Faol" name="isActive" defaultChecked={r.isActive} /></div>
                  <div className="sm:col-span-4"><F label="Ichki izoh" name="note" defaultValue={r.note} /></div>
                </div>
              </AdminForm>
            </div>
          </details>
          <div className="mt-4 space-y-2">
            {zones.filter((z) => z.regionId === r.id).map((z) => (
              <details key={z.id} className="rounded-xl border border-line">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span><strong>{z.name}</strong> · {formatUZS(z.fee)}{z.freeFrom ? ` · ${formatUZS(z.freeFrom)}dan bepul` : ""}{z.isActive ? "" : " · o‘chirilgan"}</span>
                  <span className="text-xs text-forest">Tahrirlash</span>
                </summary>
                <div className="border-t border-line p-4">
                  <AdminForm action={saveZoneAction.bind(null, z.id)}>
                    <ZoneFields z={z} regionId={r.id} />
                  </AdminForm>
                </div>
              </details>
            ))}
            <details className="rounded-xl border border-dashed border-line">
              <summary className="cursor-pointer px-4 py-3 text-sm text-forest">+ Hudud qo‘shish</summary>
              <div className="border-t border-line p-4">
                <AdminForm action={saveZoneAction.bind(null, null)} submitLabel="Qo‘shish" resetOnSuccess>
                  <ZoneFields regionId={r.id} />
                </AdminForm>
              </div>
            </details>
          </div>
        </section>
      ))}

      <section className="card p-5">
        <h2 className="mb-3 text-2xl">Yangi shahar / viloyat</h2>
        <AdminForm action={saveRegionAction.bind(null, null)} submitLabel="Qo‘shish" resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-4">
            <F label="Nomi *" name="name" required />
            <F label="Slug" name="slug" placeholder="avtomatik" />
            <F label="Tartib" name="sortOrder" defaultValue={0} />
            <div className="flex items-end pb-2"><C label="Faol" name="isActive" /></div>
          </div>
        </AdminForm>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-2xl">Vaqt oraliqlari</h2>
        <p className="mb-4 text-sm text-muted">Sig‘im — bir kunda shu oraliqqa qabul qilinadigan maksimal buyurtmalar soni (bo‘sh = cheklanmagan).</p>
        <div className="space-y-3">
          {[...slots, null].map((s) => (
            <AdminForm key={s?.id ?? "new"} action={saveSlotAction.bind(null, s?.id ?? null)} submitLabel={s ? "Saqlash" : "Qo‘shish"} resetOnSuccess={!s} className={s ? "" : "border-t border-line pt-4"}>
              <div className="grid gap-3 sm:grid-cols-6">
                <F label="Nomi" name="label" defaultValue={s?.label} placeholder="avtomatik" />
                <F label="Boshlanish" name="startTime" defaultValue={s?.startTime} placeholder="09:00" required />
                <F label="Tugash" name="endTime" defaultValue={s?.endTime} placeholder="12:00" required />
                <F label="Sig‘im" name="capacity" defaultValue={s?.capacity} placeholder="∞" inputMode="numeric" />
                <F label="Tartib" name="sortOrder" defaultValue={s?.sortOrder ?? 0} inputMode="numeric" />
                <div className="flex items-end pb-2"><C label="Faol" name="isActive" defaultChecked={s?.isActive ?? true} /></div>
              </div>
            </AdminForm>
          ))}
        </div>
      </section>
    </div>
  );
}
