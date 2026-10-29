import { eq } from "drizzle-orm";
import { floristSaveProfileAction } from "@/app/florist/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { getDb, schema } from "@/db";
import { requireFlorist } from "@/lib/auth";
import { formatPhone } from "@/lib/format";

export const metadata = { title: "Do‘kon profili" };

export default async function FloristProfilePage() {
  const me = await requireFlorist();
  const db = await getDb();
  const [shop] = await db.select().from(schema.florists).where(eq(schema.florists.id, me.floristId));
  const field = (name: string, label: string, value: string | null, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`p-${name}`} className="label">
        {label}
      </label>
      <input id={`p-${name}`} name={name} defaultValue={value ?? ""} className="field py-2.5" {...extra} />
    </div>
  );
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-4xl">Do‘kon profili</h1>
      <p className="text-sm text-muted">
        Bu ma’lumotlar do‘kon sahifangizda (/dokon/{shop.slug}) mijozlarga ko‘rinadi. Yuridik nom va STIR’ni o‘zgartirish uchun Gulzor bilan bog‘laning.
      </p>
      <section className="card p-6">
        <AdminForm action={floristSaveProfileAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("name", "Do‘kon nomi *", shop.name, { required: true, minLength: 2, maxLength: 80 })}
            {field("nameRu", "Nomi (rus.)", shop.nameRu, { maxLength: 80 })}
            {field("phone", "Telefon *", formatPhone(shop.phone), { required: true, inputMode: "tel" })}
            {field("telegramUsername", "Telegram username", shop.telegramUsername, { placeholder: "dokon_nomi" })}
            {field("address", "Manzil", shop.address, { maxLength: 200 })}
            {field("addressRu", "Manzil (rus.)", shop.addressRu, { maxLength: 200 })}
          </div>
          <div>
            <label htmlFor="p-description" className="label">
              Do‘kon haqida
            </label>
            <textarea id="p-description" name="description" defaultValue={shop.description} rows={4} maxLength={1000} className="field" />
          </div>
          <div>
            <label htmlFor="p-descriptionRu" className="label">
              Do‘kon haqida (rus.)
            </label>
            <textarea id="p-descriptionRu" name="descriptionRu" defaultValue={shop.descriptionRu ?? ""} rows={4} maxLength={1000} className="field" />
          </div>
        </AdminForm>
      </section>
      <section className="card p-6 text-sm">
        <h2 className="mb-2 text-2xl">Tekshiruv ma’lumotlari</h2>
        <p>Yuridik nom: {shop.legalName || "—"}</p>
        <p>STIR: {shop.taxId || "—"}</p>
        <p>Komissiya: {(shop.commissionRate / 100).toLocaleString("uz-UZ")}%</p>
      </section>
    </div>
  );
}
