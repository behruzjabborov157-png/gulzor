import { desc, isNull } from "drizzle-orm";
import { SubmitButton } from "@/components/admin/submit-button";
import { getDb, schema } from "@/db";
import { setRequestStatusAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { formatDateISO, formatDateTime, formatPhone, formatUZS } from "@/lib/format";

export const metadata = { title: "So‘rovlar" };

const STATUS = { new: "Yangi", contacted: "Bog‘lanildi", closed: "Yopildi" } as const;

export default async function RequestsAdmin() {
  await requireAdmin();
  const db = await getDb();
  const [requests, subs] = await Promise.all([
    db.select().from(schema.customRequests).orderBy(desc(schema.customRequests.createdAt)).limit(100),
    db.select().from(schema.subscribers).where(isNull(schema.subscribers.unsubscribedAt)).orderBy(desc(schema.subscribers.consentAt)).limit(200),
  ]);
  return (
    <div className="max-w-5xl space-y-8">
      <section>
        <h1 className="mb-4 text-4xl">Maxsus guldasta so‘rovlari</h1>
        {requests.length === 0 ? <p className="text-muted">So‘rovlar yo‘q.</p> : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="card p-5 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">#{r.id} · {r.name} · <a href={`tel:${r.phone}`} className="text-wine">{formatPhone(r.phone)}</a></p>
                    <p className="text-muted">{formatDateTime(r.createdAt)} · {r.occasion || "munosabat ko‘rsatilmagan"}{r.budget ? ` · byudjet ${formatUZS(r.budget)}` : ""}{r.desiredDate ? ` · ${formatDateISO(r.desiredDate)}` : ""}</p>
                  </div>
                  <div className="flex gap-1">
                    {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((s) => (
                      <form key={s} action={setRequestStatusAction.bind(null, r.id, s)}>
                        <SubmitButton className={`chip py-1 text-xs ${r.status === s ? "chip-active" : ""}`} aria-pressed={r.status === s}>{STATUS[s]}</SubmitButton>
                      </form>
                    ))}
                  </div>
                </div>
                {r.colors ? <p className="mt-2">Ranglar: {r.colors}</p> : null}
                <p className="mt-2 whitespace-pre-line">{r.description}</p>
                {r.imagePath ? (
                  // Private upload: served only to admins, so a plain <img> (the optimizer cannot read it).
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={r.imagePath} target="_blank" rel="noreferrer"><img src={r.imagePath} alt="Mijoz yuborgan namunaviy rasm" className="mt-3 h-40 rounded-xl object-cover" /></a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-3xl">Obunachilar ({subs.length})</h2>
        <p className="mb-3 text-sm text-muted">Faqat aniq rozilik bergan raqamlar. Xabar yuborishda obunani bekor qilish imkonini bering.</p>
        <div className="card max-h-80 overflow-y-auto p-4 text-sm">
          {subs.length === 0 ? <p className="text-muted">Hali obunachi yo‘q.</p> : subs.map((s) => <p key={s.id}>{formatPhone(s.phone)} <span className="text-xs text-muted">· {formatDateTime(s.consentAt)}</span></p>)}
        </div>
      </section>
    </div>
  );
}
