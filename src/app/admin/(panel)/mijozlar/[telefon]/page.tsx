import Link from "next/link";
import { notFound } from "next/navigation";
import { LANGUAGE_NAME_UZ } from "@/i18n/config";
import { panelT } from "@/i18n/panel/server";
import { requireAdmin } from "@/lib/auth";
import { customerDetail, phoneFromParam } from "@/lib/customers-admin";
import { formatDateTime, formatPhone } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/orders";

export async function generateMetadata() {
  return { title: (await panelT())("Mijoz") };
}

export default async function CustomerAdmin({ params }: { params: Promise<{ telefon: string }> }) {
  const tt = await panelT();
  await requireAdmin();
  const phone = phoneFromParam((await params).telefon);
  const c = phone ? await customerDetail(phone) : null;
  if (!phone || !c) notFound();

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/admin/mijozlar" className="text-sm text-muted hover:text-wine">
          {tt("← Mijozlar")}
        </Link>
        <h1 className="mt-2 text-4xl">{c.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {formatPhone(phone)}
          {c.telegram ? " · Telegram" : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-muted">{tt("Buyurtmalar")}</p>
          <p className="text-2xl font-semibold">{c.orders.length}</p>
          <p className="text-xs text-muted">{tt("yetkazilgan: {n}", { n: c.delivered })}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">{tt("Xaridlar summasi")}</p>
          <p className="text-2xl font-semibold">{tt.uzs(c.spent)}</p>
          <p className="text-xs text-muted">{tt("bekor qilinganlarsiz")}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">{tt("Saytdagi hisob")}</p>
          {c.account ? (
            <>
              <p className="font-semibold">{tt("Bor")}</p>
              <p className="text-xs text-muted">
                {tt("ochilgan: {date}", { date: formatDateTime(c.account.createdAt) })} · {tt(LANGUAGE_NAME_UZ[c.account.locale] ?? c.account.locale)}
              </p>
            </>
          ) : (
            <p className="font-semibold">{tt("Yo‘q (mehmon sifatida buyurtma bergan)")}</p>
          )}
        </div>
      </div>

      {c.addresses.length ? (
        <section className="card p-5" aria-label={tt("Saqlangan manzillar")}>
          <h2 className="mb-3 text-2xl">{tt("Saqlangan manzillar")}</h2>
          <ul className="space-y-2 text-sm">
            {c.addresses.map((a) => (
              <li key={a.id}>
                <strong>{a.label}</strong> — {[a.district, a.neighborhood, a.address, a.apartment].filter(Boolean).join(", ")}
                <span className="text-muted"> · {a.recipientName}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card overflow-x-auto" aria-label={tt("Buyurtmalar")}>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3">{tt("Raqam")}</th>
              <th className="px-4 py-3">{tt("Yaratildi")}</th>
              <th className="px-4 py-3">{tt("Do‘kon")}</th>
              <th className="px-4 py-3">{tt("Holat")}</th>
              <th className="px-4 py-3">{tt("To‘lov")}</th>
              <th className="px-4 py-3 text-right">{tt("Jami")}</th>
            </tr>
          </thead>
          <tbody>
            {c.orders.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/buyurtmalar/${o.id}`} className="text-wine underline">
                    {o.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                <td className="px-4 py-3">{o.shop}</td>
                <td className="px-4 py-3">{tt(ORDER_STATUS_LABEL[o.status])}</td>
                <td className="px-4 py-3 text-xs">{tt(PAYMENT_STATUS_LABEL[o.paymentStatus])}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{tt.uzs(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
