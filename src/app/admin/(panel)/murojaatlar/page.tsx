import Link from "next/link";
import { resolveDisputeAction } from "@/app/admin/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { DISPUTE_REASON_LABEL, DISPUTE_STATUS_LABEL, listDisputes } from "@/lib/trust";

export const metadata = { title: "Murojaatlar" };

const TABS = [
  { key: "open", label: "Ochiq" },
  { key: "resolved", label: "Hal qilingan" },
  { key: "rejected", label: "Asossiz" },
] as const;

/** Customer complaints about orders. The decision text is shown to the customer on the order page. */
export default async function DisputesAdminPage({ searchParams }: { searchParams: Promise<{ holat?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = TABS.find((t) => t.key === sp.holat)?.key ?? "open";
  const rows = await listDisputes({ status });

  return (
    <div className="max-w-5xl">
      <h1 className="mb-2 text-4xl">Murojaatlar</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted">
        Mijoz buyurtma sahifasidan yetkazish sanasidan keyin 7 kungacha murojaat qila oladi. Do‘kon izohini o‘qing, mijoz bilan bog‘laning va
        qarorni yozing. Pul qaytarilsa, buni qarorda aniq yozing (masalan, “do‘kon 150 000 so‘mni naqd qaytaradi”).
      </p>
      <nav aria-label="Holat bo‘yicha" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/murojaatlar?holat=${t.key}`} className={`chip ${status === t.key ? "chip-active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="card p-8 text-center text-muted">Murojaat yo‘q</p>
      ) : (
        <ul className="space-y-4">
          {rows.map(({ d, florist, number, orderId }) => (
            <li key={d.id} className="card p-5 text-sm">
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{DISPUTE_REASON_LABEL[d.reason]}</b> · {florist} ·{" "}
                  <Link href={`/admin/buyurtmalar/${orderId}`} className="text-wine hover:underline">
                    {number}
                  </Link>
                </span>
                <span className="text-muted">
                  {formatDateTime(d.createdAt)} · {DISPUTE_STATUS_LABEL[d.status]}
                </span>
              </p>
              <p className="mt-2 whitespace-pre-line">{d.message}</p>
              <p className="mt-2 text-muted">Do‘kon izohi: {d.floristNote ?? "hali yo‘q"}</p>
              {d.status === "open" ? (
                <AdminForm action={resolveDisputeAction.bind(null, d.id)} submitLabel="Qarorni saqlash" className="mt-3">
                  <fieldset className="flex flex-wrap gap-4">
                    <legend className="sr-only">Natija</legend>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="status" value="resolved" defaultChecked className="accent-wine" /> Hal qilindi
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="status" value="rejected" className="accent-wine" /> Asossiz
                    </label>
                  </fieldset>
                  <label htmlFor={`resolution-${d.id}`} className="label mt-2">
                    Qaror (mijozga ko‘rinadi) *
                  </label>
                  <textarea id={`resolution-${d.id}`} name="resolution" required minLength={3} rows={3} maxLength={2000} className="field" />
                </AdminForm>
              ) : (
                <p className="mt-2 text-wine">
                  Qaror: {d.resolution} <span className="text-muted">— {d.resolvedBy}, {d.resolvedAt ? formatDateTime(d.resolvedAt) : ""}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
