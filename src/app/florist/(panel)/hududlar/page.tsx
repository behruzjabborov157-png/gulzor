import { asc, eq } from "drizzle-orm";
import { floristSaveZoneAction } from "@/app/florist/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { getDb, schema } from "@/db";
import { requireFlorist } from "@/lib/auth";
import { floristZones } from "@/lib/florist-panel";

export const metadata = { title: "Yetkazib berish" };

type Zone = Awaited<ReturnType<typeof floristZones>>[number];
type Region = { id: number; name: string };

function ZoneFields({ z, regions, prefix }: { z: Zone | null; regions: Region[]; prefix: string }) {
  const id = (k: string) => `${prefix}-${k}`;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label htmlFor={id("region")} className="label">
          Shahar
        </label>
        <select id={id("region")} name="regionId" defaultValue={z?.regionId ?? regions[0]?.id} className="field py-2.5">
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={id("name")} className="label">
          Hudud nomi *
        </label>
        <input id={id("name")} name="name" defaultValue={z?.name ?? ""} required minLength={2} maxLength={80} className="field py-2.5" placeholder="Masalan: Markaziy tumanlar" />
      </div>
      <div>
        <label htmlFor={id("nameRu")} className="label">
          Nomi (rus.)
        </label>
        <input id={id("nameRu")} name="nameRu" defaultValue={z?.nameRu ?? ""} maxLength={80} className="field py-2.5" />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label htmlFor={id("desc")} className="label">
          Qaysi tumanlar / mahallalar
        </label>
        <input id={id("desc")} name="description" defaultValue={z?.description ?? ""} maxLength={300} className="field py-2.5" />
      </div>
      <div>
        <label htmlFor={id("fee")} className="label">
          Yetkazish narxi, so‘m *
        </label>
        <input id={id("fee")} name="fee" inputMode="numeric" defaultValue={z?.fee ?? ""} required className="field py-2.5" />
      </div>
      <div>
        <label htmlFor={id("free")} className="label">
          Shu summadan bepul
        </label>
        <input id={id("free")} name="freeFrom" inputMode="numeric" defaultValue={z?.freeFrom ?? ""} className="field py-2.5" />
      </div>
      <div>
        <label htmlFor={id("min")} className="label">
          Minimal buyurtma
        </label>
        <input id={id("min")} name="minOrder" inputMode="numeric" defaultValue={z?.minOrder ?? ""} className="field py-2.5" />
      </div>
      <div>
        <label htmlFor={id("cut")} className="label">
          Bugungi buyurtma — soat nechagacha
        </label>
        <input id={id("cut")} name="sameDayCutoff" defaultValue={z?.sameDayCutoff ?? "16:00"} pattern="[0-2][0-9]:[0-5][0-9]" className="field py-2.5" />
      </div>
      <div>
        <label htmlFor={id("lead")} className="label">
          Tayyorlash + yo‘l, daqiqa
        </label>
        <input id={id("lead")} name="minLeadMinutes" inputMode="numeric" defaultValue={z?.minLeadMinutes ?? 120} className="field py-2.5" />
      </div>
      <div className="flex flex-col justify-end gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="sameDayEnabled" defaultChecked={z?.sameDayEnabled ?? true} className="h-4 w-4 accent-wine" /> Shu kuni yetkazish mumkin
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isActive" defaultChecked={z?.isActive ?? true} className="h-4 w-4 accent-wine" /> Faol
        </label>
      </div>
    </div>
  );
}

export default async function FloristZonesPage() {
  const me = await requireFlorist();
  const db = await getDb();
  const [zones, regions] = await Promise.all([
    floristZones(me.floristId),
    db
      .select({ id: schema.deliveryRegions.id, name: schema.deliveryRegions.name })
      .from(schema.deliveryRegions)
      .where(eq(schema.deliveryRegions.isActive, true))
      .orderBy(asc(schema.deliveryRegions.sortOrder)),
  ]);
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-4xl">Yetkazib berish</h1>
        <p className="mt-2 text-sm text-muted">
          Buyurtmalarni o‘zingiz yetkazasiz: qaysi hududlarga va qancha narxda. Mijoz faqat shu hududlarni tanlay oladi. Hududni o‘chirish o‘rniga “Faol”
          belgisini olib tashlang — eski buyurtmalar tarixi saqlanadi.
        </p>
      </div>
      {zones.map((z) => (
        <section key={z.id} className="card p-5" aria-label={z.name}>
          <h2 className="mb-3 font-sans text-base font-semibold">
            {z.name} {z.isActive ? null : <span className="badge bg-charcoal/10 text-muted">o‘chirilgan</span>}
          </h2>
          <AdminForm action={floristSaveZoneAction.bind(null, z.id)}>
            <ZoneFields z={z} regions={regions} prefix={`z${z.id}`} />
          </AdminForm>
        </section>
      ))}
      <section className="card border-dashed p-5" aria-label="Yangi hudud">
        <h2 className="mb-3 font-sans text-base font-semibold">+ Yangi hudud</h2>
        <AdminForm action={floristSaveZoneAction.bind(null, null)} submitLabel="Qo‘shish" resetOnSuccess>
          <ZoneFields z={null} regions={regions} prefix="new" />
        </AdminForm>
      </section>
    </div>
  );
}
