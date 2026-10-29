import { floristReviewReplyAction } from "@/app/florist/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { requireFlorist } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { listReviews } from "@/lib/trust";

export const metadata = { title: "Sharhlar" };

const STATUS: Record<string, string> = { pending: "Gulzor tekshiruvida", approved: "E’lon qilingan", rejected: "E’lon qilinmagan" };

/** Reviews of the shop's own delivered orders; the shop can answer publicly. */
export default async function FloristReviewsPage() {
  const me = await requireFlorist();
  const rows = await listReviews({ floristId: me.floristId });
  const published = rows.filter((x) => x.r.status === "approved");
  const avg = published.length ? Math.round((published.reduce((s, x) => s + x.r.rating, 0) / published.length) * 10) / 10 : null;

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-4xl">Sharhlar</h1>
      <p className="text-sm text-muted">
        Sharhni faqat buyurtmasi yetkazilgan mijoz qoldira oladi. Gulzor tekshirgach, do‘kon sahifangizda chiqadi. Javobingiz ham ochiq ko‘rinadi.
        {avg != null ? ` O‘rtacha baho: ${avg.toLocaleString("uz-UZ")} (${published.length} ta).` : ""}
      </p>
      {rows.length === 0 ? (
        <p className="card p-8 text-center text-muted">Hali sharh yo‘q.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map(({ r, number }) => (
            <li key={r.id} className="card p-5 text-sm">
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="text-coral" aria-label={`${r.rating} yulduz`}>
                    {"★".repeat(r.rating)}
                    <span className="text-line">{"★".repeat(5 - r.rating)}</span>
                  </span>{" "}
                  <b>{r.authorName}</b> · buyurtma {number}
                </span>
                <span className="text-muted">
                  {formatDateTime(r.createdAt)} · {STATUS[r.status]}
                </span>
              </p>
              {r.text ? <p className="mt-2 whitespace-pre-line">{r.text}</p> : null}
              {r.status !== "rejected" ? (
                <AdminForm action={floristReviewReplyAction.bind(null, r.id)} submitLabel="Javobni saqlash" className="mt-3">
                  <label htmlFor={`reply-${r.id}`} className="label">
                    Do‘kon javobi (ochiq ko‘rinadi)
                  </label>
                  <textarea id={`reply-${r.id}`} name="reply" defaultValue={r.floristReply ?? ""} rows={2} maxLength={1000} className="field" />
                </AdminForm>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
