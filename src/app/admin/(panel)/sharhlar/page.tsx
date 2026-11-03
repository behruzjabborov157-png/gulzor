import { panelT } from "@/i18n/panel/server";
import { LANGUAGE_NAME_UZ } from "@/i18n/config";
import Link from "next/link";
import { moderateReviewAction } from "@/app/admin/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { listReviews, type ReviewStatus } from "@/lib/trust";

export async function generateMetadata() {
  return { title: (await panelT())("Sharhlar") };
}

const TABS: { key: ReviewStatus; label: string }[] = [
  { key: "pending", label: "Tekshiruvda" },
  { key: "approved", label: "E’lon qilingan" },
  { key: "rejected", label: "Rad etilgan" },
];

/**
 * Verified-purchase reviews. Publish honest reviews, good or bad; reject only what breaks the rules
 * (insults, personal data, spam, advertising) — never because the rating is low.
 */
export default async function ReviewsAdminPage({ searchParams }: { searchParams: Promise<{ holat?: string }> }) {
  const tt = await panelT();
  await requireAdmin();
  const sp = await searchParams;
  const status = TABS.find((t) => t.key === sp.holat)?.key ?? "pending";
  const rows = await listReviews({ status });

  return (
    <div className="max-w-5xl">
      <h1 className="mb-2 text-4xl">{tt("Sharhlar")}</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted">
        {tt("Sharhni faqat buyurtmasi yetkazilgan mijoz qoldira oladi (har buyurtmaga bitta). Past bahoni ham e’lon qiling — faqat haqorat, shaxsiy ma’lumot, reklama yoki spamni rad eting.")}
      </p>
      <nav aria-label={tt("Holat bo‘yicha")} className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/sharhlar?holat=${t.key}`} className={`chip ${status === t.key ? "chip-active" : ""}`}>
            {tt(t.label)}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="card p-8 text-center text-muted">{tt("Sharh yo‘q")}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map(({ r, florist, number }) => (
            <li key={r.id} className="card p-5 text-sm">
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="text-coral" aria-label={`${r.rating} yulduz`}>
                    {"★".repeat(r.rating)}
                    <span className="text-line">{"★".repeat(5 - r.rating)}</span>
                  </span>{" "}
                  <b>{r.authorName}</b> · {florist} ·{" "}
                  <Link href={`/admin/buyurtmalar/${r.orderId}`} className="text-wine hover:underline">
                    {number}
                  </Link>
                </span>
                <span className="text-muted">
                  {formatDateTime(r.createdAt)} · {LANGUAGE_NAME_UZ[r.locale] ?? r.locale}
                </span>
              </p>
              {r.text ? <p className="mt-2 whitespace-pre-line">{tt(r.text)}</p> : <p className="mt-2 text-muted">{tt("(izohsiz)")}</p>}
              {r.floristReply ? <p className="mt-2 text-muted">{tt("Do‘kon javobi: {floristReply}", { floristReply: r.floristReply })}</p> : null}
              <div className="mt-3 flex flex-wrap gap-4">
                {r.status !== "approved" ? (
                  <AdminForm action={moderateReviewAction.bind(null, r.id, "approved")} submitLabel={tt("E’lon qilish")}>
                    {null}
                  </AdminForm>
                ) : null}
                {r.status !== "rejected" ? (
                  <AdminForm action={moderateReviewAction.bind(null, r.id, "rejected")} submitLabel={tt("Rad etish")}>
                    {null}
                  </AdminForm>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
