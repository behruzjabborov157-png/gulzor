import Image from "next/image";
import { SubmitButton } from "@/components/admin/submit-button";
import Link from "next/link";
import { and, asc, eq, ilike, inArray, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { archiveDemoProductsAction, quickUpdateProductAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatUZS } from "@/lib/format";

export const metadata = { title: "Mahsulotlar" };

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; holat?: string; demo?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const where: SQL[] = [];
  if (sp.q) where.push(ilike(schema.products.name, `%${sp.q}%`));
  if (sp.holat === "active" || sp.holat === "draft" || sp.holat === "archived") where.push(eq(schema.products.status, sp.holat));
  if (sp.demo === "1") where.push(eq(schema.products.isDemo, true));
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.products)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(schema.products.isAddon), asc(schema.products.name));
  const variants = rows.length
    ? await db.select().from(schema.productVariants).where(inArray(schema.productVariants.productId, rows.map((r) => r.id)))
    : [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">Mahsulotlar</h1>
        <div className="flex flex-wrap gap-2">
          {admin.role === "owner" ? (
            <form action={archiveDemoProductsAction}>
              <SubmitButton className="btn-secondary btn-sm" title="Barcha namuna mahsulotlarni arxivga o‘tkazish">Namunalarni arxivlash</SubmitButton>
            </form>
          ) : null}
          <Link href="/admin/mahsulotlar/yangi" className="btn-primary btn-sm">+ Yangi mahsulot</Link>
        </div>
      </div>
      <form className="card mb-4 flex flex-wrap gap-3 p-4" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Nomi bo‘yicha qidirish" className="field max-w-xs py-2" aria-label="Qidiruv" />
        <select name="holat" defaultValue={sp.holat ?? ""} className="field w-auto py-2" aria-label="Holat">
          <option value="">Barchasi</option>
          <option value="active">Faol</option>
          <option value="draft">Qoralama</option>
          <option value="archived">Arxiv</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="demo" value="1" defaultChecked={sp.demo === "1"} className="accent-forest" /> Faqat namunalar
        </label>
        <button className="btn-secondary btn-sm">Filtrlash</button>
      </form>

      <p className="mb-3 text-sm text-muted">{rows.length} ta mahsulot. Narx/ombor/holatni shu yerning o‘zida o‘zgartirib, “Saqlash”ni bosing. O‘lchamli va donalab narxlanadiganlar uchun mahsulotni oching.</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-line bg-ivory text-xs text-muted">
            <tr>
              <th className="px-3 py-3 font-medium">Mahsulot</th>
              <th className="px-3 py-3 font-medium">Narx (so‘m)</th>
              <th className="px-3 py-3 font-medium">Ombor</th>
              <th className="px-3 py-3 font-medium">Mavjudlik</th>
              <th className="px-3 py-3 font-medium">Holat</th>
              <th className="px-3 py-3 font-medium">Narx yangilangan</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => {
              const vs = variants.filter((v) => v.productId === p.id);
              const formId = `q-${p.id}`;
              return (
                <tr key={p.id} className="align-middle">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-ivory-deep">
                        {p.images[0] ? <Image src={p.images[0].url} alt="" fill sizes="40px" className="object-cover" /> : null}
                      </div>
                      <div>
                        <Link href={`/admin/mahsulotlar/${p.id}`} className="font-medium hover:text-forest hover:underline">{p.name}</Link>
                        <p className="text-xs text-muted">
                          {p.isDemo ? "namuna · " : ""}{p.isAddon ? "qo‘shimcha · " : ""}{p.pricingMode === "variants" ? "o‘lchamlar" : p.pricingMode === "per_stem" ? "donalab" : "qat’iy narx"} · {p.salesCount} sotilgan
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {p.pricingMode === "fixed" ? (
                      <input form={formId} name="price" defaultValue={p.price} inputMode="numeric" className="field w-28 px-2 py-1.5" aria-label={`${p.name} narxi`} />
                    ) : p.pricingMode === "variants" ? (
                      <span className="text-xs">{vs.map((v) => `${v.name}: ${formatUZS(v.price)}`).join(" · ")}</span>
                    ) : (
                      <span className="text-xs">{formatUZS(p.stemPrice ?? 0)} / dona</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input form={formId} name="stockQuantity" defaultValue={p.stockQuantity ?? ""} placeholder="∞" inputMode="numeric" className="field w-20 px-2 py-1.5" aria-label={`${p.name} ombordagi soni (bo‘sh = hisob yuritilmaydi)`} />
                  </td>
                  <td className="px-3 py-2">
                    <select form={formId} name="availability" defaultValue={p.availability} className="field w-auto px-2 py-1.5" aria-label="Mavjudlik">
                      <option value="in_stock">Mavjud</option>
                      <option value="made_to_order">Buyurtma asosida</option>
                      <option value="out_of_stock">Mavjud emas</option>
                    </select>
                    {p.seasonalMonths.length ? <p className="mt-0.5 text-[11px] text-muted">Mavsum: {p.seasonalMonths.join(", ")}-oylar</p> : null}
                  </td>
                  <td className="px-3 py-2">
                    <select form={formId} name="status" defaultValue={p.status} className="field w-auto px-2 py-1.5" aria-label="Holat">
                      <option value="active">Faol</option>
                      <option value="draft">Qoralama</option>
                      <option value="archived">Arxiv</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{formatDateTime(p.priceUpdatedAt)}</td>
                  <td className="px-3 py-2">
                    <form id={formId} action={quickUpdateProductAction.bind(null, p.id)}>
                      <SubmitButton className="btn-secondary btn-sm">Saqlash</SubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
