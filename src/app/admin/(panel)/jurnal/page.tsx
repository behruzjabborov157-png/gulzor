import { panelT } from "@/i18n/panel/server";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { auditCount, auditEntries, describeAudit } from "@/lib/florist-admin";

export async function generateMetadata() {
  return { title: (await panelT())("Jurnal") };
}

const ENTITIES = [
  { key: "", label: "Barchasi" },
  { key: "florist", label: "Do‘konlar" },
  { key: "order", label: "Buyurtmalar" },
];

/** Who changed what: shop moderation, commission, profile edits and manual order changes. */
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ tur?: string; sahifa?: string }> }) {
  const tt = await panelT();
  await requireOwner();
  const sp = await searchParams;
  const entity = ENTITIES.some((e) => e.key && e.key === sp.tur) ? sp.tur : undefined;
  const page = Math.max(1, Number(sp.sahifa) || 1);
  const perPage = 50;
  const [rows, total] = await Promise.all([auditEntries({ entity, limit: perPage, offset: (page - 1) * perPage }), auditCount(entity)]);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (entity) u.set("tur", entity);
    if (p > 1) u.set("sahifa", String(p));
    return `/admin/jurnal?${u}`;
  };
  const link = (entityName: string, id: string) =>
    entityName === "florist" ? `/admin/floristlar/${id}` : entityName === "order" ? `/admin/buyurtmalar/${id}` : null;

  return (
    <div>
      <h1 className="mb-2 text-4xl">{tt("Jurnal")}</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted">{tt("Do‘konlarni tasdiqlash, komissiya, profil va buyurtmalardagi qo‘lda o‘zgarishlar — kim va qachon qilgani.")}</p>
      <nav aria-label={tt("Turi bo‘yicha")} className="mb-5 flex flex-wrap gap-2">
        {ENTITIES.map((e) => (
          <Link key={e.key || "all"} href={e.key ? `/admin/jurnal?tur=${e.key}` : "/admin/jurnal"} className={`chip ${(entity ?? "") === e.key ? "chip-active" : ""}`}>
            {tt(e.label)}
          </Link>
        ))}
      </nav>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-ivory text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{tt("Vaqt")}</th>
              <th className="px-4 py-3 font-medium">{tt("Kim")}</th>
              <th className="px-4 py-3 font-medium">{tt("Nima")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted">
                  {tt("Hali yozuv yo‘q")}
                </td>
              </tr>
            ) : (
              rows.map((e) => {
                const href = link(e.entity, e.entityId);
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(e.createdAt)}</td>
                    <td className="px-4 py-3">{e.actorEmail || "—"}</td>
                    <td className="px-4 py-3">
                      {href ? (
                        <Link href={href} className="text-wine hover:underline">
                          {describeAudit(e)}
                        </Link>
                      ) : (
                        describeAudit(e)
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav className="mt-4 flex gap-2" aria-label={tt("Sahifalar")}>
          {page > 1 ? <Link href={qs(page - 1)} className="chip">{tt("← Oldingi")}</Link> : null}
          <span className="chip chip-active">
            {page} / {pages}
          </span>
          {page < pages ? <Link href={qs(page + 1)} className="chip">{tt("Keyingi →")}</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}
