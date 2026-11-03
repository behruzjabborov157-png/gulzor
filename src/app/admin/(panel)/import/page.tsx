import { panelT } from "@/i18n/panel/server";
import { importProductsAction } from "@/app/admin/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { requireOwner } from "@/lib/auth";
import { PRODUCT_CSV_COLUMNS } from "@/lib/csv";

export async function generateMetadata() {
  return { title: (await panelT())("Import / eksport") };
}

export default async function ImportAdmin() {
  const tt = await panelT();
  await requireOwner();
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-4xl">{tt("Import / eksport")}</h1>
      <section className="card space-y-3 p-6">
        <h2 className="text-2xl">{tt("Mahsulotlarni eksport qilish")}</h2>
        <p className="text-sm text-muted">{tt("Joriy katalogni CSV (Excel’da ochiladi) ko‘rinishida yuklab oling, narx va qoldiqlarni tahrirlab, qayta import qiling.")}</p>
        <div className="flex flex-wrap gap-2">
          {/* A file download from a route handler, not a page — a plain <a download> is correct here. */}
          <a href="/admin/import/eksport" className="btn-primary btn-sm" download>
            {tt("CSV yuklab olish")}
          </a>
          <a href="/product-import-template.csv" className="btn-secondary btn-sm" download>{tt("Bo‘sh shablon")}</a>
        </div>
      </section>
      <section className="card space-y-3 p-6">
        <h2 className="text-2xl">{tt("CSV import")}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>{tt("Mahsulot")}{" "}<code>{tt("slug")}</code>{" "}{tt("bo‘yicha topiladi: mavjud bo‘lsa yangilanadi, aks holda yaratiladi.")}</li>
          <li>{tt("Majburiy ustunlar:")}{" "}<code>{tt("slug, name, price")}</code>{tt(". Narxlar so‘mda, butun son.")}</li>
          <li><code>{tt("categories")}</code>{" "}{tt("va")}{" "}<code>{tt("flower_varieties")}</code>{" "}{tt("qiymatlarini")}{" "}<code>|</code>{" "}{tt("bilan ajrating (masalan")}{" "}<code>{tt("atirgullar|tugilgan-kun")}</code>).</li>
          <li><code>{tt("status")}</code>{tt(": active / draft / archived;")}{" "}<code>{tt("availability")}</code>{tt(": in_stock / made_to_order / out_of_stock;")}{" "}<code>{tt("stock_quantity")}</code>{" "}{tt("bo‘sh — hisob yuritilmaydi.")}</li>
          <li>{tt("Import faqat qat’iy narxli mahsulotlar uchun; o‘lchamli/donalab mahsulotlarni tahrirlash sahifasida o‘zgartiring.")}</li>
        </ul>
        <p className="text-xs text-muted">{tt("Ustunlar: {p}", { p: PRODUCT_CSV_COLUMNS.join(", ") })}</p>
        <AdminForm action={importProductsAction} submitLabel={tt("Import qilish")}>
          <input type="file" name="file" accept=".csv,text/csv" required className="block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-wine/10 file:px-4 file:py-2 file:text-wine" aria-label={tt("CSV fayl")} />
        </AdminForm>
      </section>
    </div>
  );
}
