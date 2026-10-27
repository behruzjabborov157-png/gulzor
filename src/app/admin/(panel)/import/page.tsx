import { importProductsAction } from "@/app/admin/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { requireOwner } from "@/lib/auth";
import { PRODUCT_CSV_COLUMNS } from "@/lib/csv";

export const metadata = { title: "Import / eksport" };

export default async function ImportAdmin() {
  await requireOwner();
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-4xl">Import / eksport</h1>
      <section className="card space-y-3 p-6">
        <h2 className="text-2xl">Mahsulotlarni eksport qilish</h2>
        <p className="text-sm text-muted">Joriy katalogni CSV (Excel’da ochiladi) ko‘rinishida yuklab oling, narx va qoldiqlarni tahrirlab, qayta import qiling.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/admin/import/eksport" className="btn-primary btn-sm">CSV yuklab olish</a>
          <a href="/product-import-template.csv" className="btn-secondary btn-sm" download>Bo‘sh shablon</a>
        </div>
      </section>
      <section className="card space-y-3 p-6">
        <h2 className="text-2xl">CSV import</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Mahsulot <code>slug</code> bo‘yicha topiladi: mavjud bo‘lsa yangilanadi, aks holda yaratiladi.</li>
          <li>Majburiy ustunlar: <code>slug, name, price</code>. Narxlar so‘mda, butun son.</li>
          <li><code>categories</code> va <code>flower_varieties</code> qiymatlarini <code>|</code> bilan ajrating (masalan <code>atirgullar|tugilgan-kun</code>).</li>
          <li><code>status</code>: active / draft / archived; <code>availability</code>: in_stock / made_to_order / out_of_stock; <code>stock_quantity</code> bo‘sh — hisob yuritilmaydi.</li>
          <li>Import faqat qat’iy narxli mahsulotlar uchun; o‘lchamli/donalab mahsulotlarni tahrirlash sahifasida o‘zgartiring.</li>
        </ul>
        <p className="text-xs text-muted">Ustunlar: {PRODUCT_CSV_COLUMNS.join(", ")}</p>
        <AdminForm action={importProductsAction} submitLabel="Import qilish">
          <input type="file" name="file" accept=".csv,text/csv" required className="block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-forest/10 file:px-4 file:py-2 file:text-forest" aria-label="CSV fayl" />
        </AdminForm>
      </section>
    </div>
  );
}
