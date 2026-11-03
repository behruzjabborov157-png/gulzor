import { panelT } from "@/i18n/panel/server";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { saveRegionAction, saveSlotAction, saveZoneAction } from "@/app/admin/actions";
import { AdminForm, C, F } from "@/components/admin/admin-form";
import { CoverageFields } from "@/components/admin/coverage-fields";
import { regionDistricts, regionPickerOptions, zoneCoverage } from "@/lib/locations";
import { requireOwner } from "@/lib/auth";


export async function generateMetadata() {
  return { title: (await panelT())("Yetkazib berish") };
}

type Zone = typeof schema.deliveryZones.$inferSelect;
type Picker = Awaited<ReturnType<typeof regionPickerOptions>>;

/** Which region or city of the places list a delivery area is (its districts are then offered at checkout). */
async function LocationSelect({ picker, value }: { picker: Picker; value: number | null }) {
  const tt = await panelT();
  return (
    <div className="sm:col-span-2">
      <label className="mb-1 block text-xs font-medium text-muted">
        {tt("Joylashuv (tumanlar shu yerdan olinadi)")}
        <select name="locationId" defaultValue={value ?? ""} className="field mt-1 px-3 py-2">
          <option value="">{tt("— bog‘lanmagan (tuman so‘ralmaydi) —")}</option>
          {picker.map((r) => (
            <optgroup key={r.id} label={r.name}>
              <option value={r.id}>{tt("{name} — barcha tumanlari", { name: r.name })}</option>
              {r.districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  );
}

async function ZoneFields({ z, regionId, districts, covered }: { z?: Zone; regionId: number; districts: { id: number; name: string }[]; covered: number[] }) {
  const tt = await panelT();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="regionId" value={regionId} />
      <F label={tt("Hudud nomi *")} name="name" defaultValue={z?.name} required />
      <F label={tt("Yetkazish narxi, so‘m *")} name="fee" defaultValue={z?.fee ?? ""} inputMode="numeric" required />
      <F label={tt("Bepul yetkazish (dan), so‘m")} name="freeFrom" defaultValue={z?.freeFrom} inputMode="numeric" placeholder={tt("yo‘q")} />
      <F label={tt("Minimal buyurtma, so‘m")} name="minOrder" defaultValue={z?.minOrder} inputMode="numeric" placeholder={tt("yo‘q")} />
      <div className="sm:col-span-2"><F label={tt("Qamrab olingan tumanlar (mijozga ko‘rinadi)")} name="description" defaultValue={z?.description} /></div>
      <F label={tt("Hudud nomi (rus.)")} name="nameRu" defaultValue={z?.nameRu} lang="ru" />
      <F label={tt("Hudud nomi (ingl.)")} name="nameEn" defaultValue={z?.nameEn} lang="en" />
      <div className="sm:col-span-3"><F label={tt("Qamrab olingan tumanlar (rus.)")} name="descriptionRu" defaultValue={z?.descriptionRu} lang="ru" /></div>
      <div className="sm:col-span-4"><F label={tt("Qamrab olingan tumanlar (ingl.)")} name="descriptionEn" defaultValue={z?.descriptionEn} lang="en" /></div>
      <F label={tt("Shu kunga buyurtma qabuli (gacha), SS:DD")} name="sameDayCutoff" defaultValue={z?.sameDayCutoff ?? "18:00"} pattern="[0-2][0-9]:[0-5][0-9]" />
      <F label={tt("Minimal oldindan vaqt (daqiqa)")} name="minLeadMinutes" defaultValue={z?.minLeadMinutes ?? 120} inputMode="numeric" />
      <F label={tt("Tartib")} name="sortOrder" defaultValue={z?.sortOrder ?? 0} inputMode="numeric" />
      <div className="flex flex-wrap items-end gap-4 pb-2 sm:col-span-3">
        <C label={tt("Shu kuni yetkazish mumkin")} name="sameDayEnabled" defaultChecked={z?.sameDayEnabled ?? true} />
        <C label={tt("Faol")} name="isActive" defaultChecked={z?.isActive ?? true} />
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <CoverageFields districts={districts} selected={covered} idPrefix={`z${z?.id ?? `new${regionId}`}`} />
      </div>
    </div>
  );
}

export default async function DeliveryAdmin() {
  const tt = await panelT();
  await requireOwner();
  const db = await getDb();
  const [regions, zones, slots] = await Promise.all([
    db.select().from(schema.deliveryRegions).orderBy(asc(schema.deliveryRegions.sortOrder)),
    db.select().from(schema.deliveryZones).orderBy(asc(schema.deliveryZones.sortOrder)),
    db.select().from(schema.timeSlots).orderBy(asc(schema.timeSlots.sortOrder), asc(schema.timeSlots.startTime)),
  ]);
  const [picker, coverage, districtsOf] = await Promise.all([
    regionPickerOptions(),
    zoneCoverage(zones.map((z) => z.id)),
    Promise.all(regions.map(async (r) => [r.id, (await regionDistricts(r.locationId)).map((d) => ({ id: d.id, name: d.name }))] as const)).then((e) => new Map(e)),
  ]);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-4xl">{tt("Yetkazib berish")}</h1>
        <p className="mt-2 text-sm text-muted">
          {tt("Faqat haqiqatan xizmat ko‘rsatadigan hududlarni faol qiling. Mijozlar faqat faol hududlarni ko‘radi; boshqa manzillar uchun ularga aloqa havolasi ko‘rsatiladi.")}
        </p>
      </div>

      {regions.map((r) => (
        <section key={r.id} className="card p-5">
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span className="text-2xl font-display">{r.name} {r.isActive ? "" : <span className="font-sans text-sm text-muted">{tt("(o‘chirilgan)")}</span>}</span>
              <span className="text-xs text-wine">{tt("Shahar/viloyatni tahrirlash")}</span>
            </summary>
            <div className="mt-3">
              <AdminForm action={saveRegionAction.bind(null, r.id)}>
                <div className="grid gap-3 sm:grid-cols-4">
                  <F label={tt("Nomi")} name="name" defaultValue={r.name} />
                  <F label={tt("Nomi (rus.)")} name="nameRu" defaultValue={r.nameRu} lang="ru" />
                  <F label={tt("Nomi (ingl.)")} name="nameEn" defaultValue={r.nameEn} lang="en" />
                  <F label={tt("Slug")} name="slug" defaultValue={r.slug} />
                  <F label={tt("Tartib")} name="sortOrder" defaultValue={r.sortOrder} />
                  <div className="flex items-end pb-2"><C label={tt("Faol")} name="isActive" defaultChecked={r.isActive} /></div>
                  <LocationSelect picker={picker} value={r.locationId} />
                  <div className="sm:col-span-2"><F label={tt("Ichki izoh")} name="note" defaultValue={r.note} /></div>
                </div>
              </AdminForm>
            </div>
          </details>
          <div className="mt-4 space-y-2">
            {zones.filter((z) => z.regionId === r.id).map((z) => (
              <details key={z.id} className="rounded-xl border border-line">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span><strong>{z.name}</strong>{coverage.get(z.id) ? tt(" · {length} ta tuman", { length: coverage.get(z.id)!.length }) : ""} · {tt.uzs(z.fee)}{z.freeFrom ? tt(" · {p}dan bepul", { p: tt.uzs(z.freeFrom) }) : ""}{z.isActive ? "" : tt(" · o‘chirilgan")}</span>
                  <span className="text-xs text-wine">{tt("Tahrirlash")}</span>
                </summary>
                <div className="border-t border-line p-4">
                  <AdminForm action={saveZoneAction.bind(null, z.id)}>
                    <ZoneFields z={z} regionId={r.id} districts={districtsOf.get(r.id) ?? []} covered={coverage.get(z.id) ?? []} />
                  </AdminForm>
                </div>
              </details>
            ))}
            <details className="rounded-xl border border-dashed border-line">
              <summary className="cursor-pointer px-4 py-3 text-sm text-wine">{tt("+ Hudud qo‘shish")}</summary>
              <div className="border-t border-line p-4">
                <AdminForm action={saveZoneAction.bind(null, null)} submitLabel={tt("Qo‘shish")} resetOnSuccess>
                  <ZoneFields regionId={r.id} districts={districtsOf.get(r.id) ?? []} covered={[]} />
                </AdminForm>
              </div>
            </details>
          </div>
        </section>
      ))}

      <section className="card p-5">
        <h2 className="mb-3 text-2xl">{tt("Yangi shahar / viloyat")}</h2>
        <AdminForm action={saveRegionAction.bind(null, null)} submitLabel={tt("Qo‘shish")} resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-4">
            <F label={tt("Nomi *")} name="name" required />
            <F label={tt("Nomi (rus.)")} name="nameRu" lang="ru" />
            <F label={tt("Nomi (ingl.)")} name="nameEn" lang="en" />
            <F label={tt("Slug")} name="slug" placeholder={tt("avtomatik")} />
            <F label={tt("Tartib")} name="sortOrder" defaultValue={0} />
            <div className="flex items-end pb-2"><C label={tt("Faol")} name="isActive" /></div>
            <LocationSelect picker={picker} value={null} />
          </div>
        </AdminForm>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-2xl">{tt("Vaqt oraliqlari")}</h2>
        <p className="mb-4 text-sm text-muted">{tt("Sig‘im — bir kunda shu oraliqqa qabul qilinadigan maksimal buyurtmalar soni (bo‘sh = cheklanmagan).")}</p>
        <div className="space-y-3">
          {[...slots, null].map((s) => (
            <AdminForm key={s?.id ?? "new"} action={saveSlotAction.bind(null, s?.id ?? null)} submitLabel={s ? tt("Saqlash") : tt("Qo‘shish")} resetOnSuccess={!s} className={s ? "" : "border-t border-line pt-4"}>
              <div className="grid gap-3 sm:grid-cols-6">
                <F label={tt("Nomi")} name="label" defaultValue={s?.label} placeholder={tt("avtomatik")} />
                <F label={tt("Boshlanish")} name="startTime" defaultValue={s?.startTime} placeholder="09:00" required />
                <F label={tt("Tugash")} name="endTime" defaultValue={s?.endTime} placeholder="12:00" required />
                <F label={tt("Sig‘im")} name="capacity" defaultValue={s?.capacity} placeholder="∞" inputMode="numeric" />
                <F label={tt("Tartib")} name="sortOrder" defaultValue={s?.sortOrder ?? 0} inputMode="numeric" />
                <div className="flex items-end pb-2"><C label={tt("Faol")} name="isActive" defaultChecked={s?.isActive ?? true} /></div>
              </div>
            </AdminForm>
          ))}
        </div>
      </section>
    </div>
  );
}
