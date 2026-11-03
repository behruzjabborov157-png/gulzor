import { panelT } from "@/i18n/panel/server";
import Link from "next/link";
import Image from "next/image";
import { requireFlorist } from "@/lib/auth";
import { floristProducts } from "@/lib/florist-panel";


export async function generateMetadata() {
  return { title: (await panelT())("Mahsulotlar") };
}

const STATUS: Record<string, string> = { active: "Faol", draft: "Qoralama", archived: "Arxiv" };

export default async function FloristProductsPage() {
  const tt = await panelT();
  const me = await requireFlorist();
  const products = await floristProducts(me.floristId);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">{tt("Mahsulotlar")}</h1>
        <Link href="/florist/mahsulotlar/yangi" className="btn-primary btn-sm">
          {tt("+ Yangi mahsulot")}
        </Link>
      </div>
      {products.length === 0 ? (
        <p className="card p-8 text-center text-muted">{tt("Hali mahsulot yo‘q. Birinchi guldastangizni rasm bilan qo‘shing.")}</p>
      ) : (
        <ul className="card divide-y divide-line">
          {products.map((p) => (
            <li key={p.id} className="flex items-center gap-4 p-4">
              <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-cream">
                {p.images[0] ? <Image src={p.images[0].url} alt="" fill sizes="56px" className="object-cover" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <Link href={`/florist/mahsulotlar/${p.id}`} className="font-semibold text-plum hover:text-wine">
                  {p.name}
                </Link>
                <span className="block text-xs text-muted">
                  {tt(STATUS[p.status])} · {p.pricingMode === "fixed" ? tt.uzs(p.price) : p.pricingMode === "variants" ? tt("o‘lchamlar bo‘yicha") : tt("dona hisobida")}
                  {p.stockQuantity != null ? tt(" · qoldiq: {stockQuantity}", { stockQuantity: p.stockQuantity }) : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
