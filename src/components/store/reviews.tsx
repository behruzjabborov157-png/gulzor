import { fmt, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { formatDateISO } from "@/lib/format";
import { publicReviews } from "@/lib/trust";

/** Approved verified-purchase reviews of a shop or product. Renders nothing until there is at least one. */
export async function Reviews({ by, locale, className = "" }: { by: { floristId: number } | { productId: number }; locale: Locale; className?: string }) {
  const { reviews, count, average } = await publicReviews(by);
  if (!count || average == null) return null;
  const t = getDict(locale).shop;
  return (
    <section className={className} aria-labelledby="reviews-h">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="reviews-h" className="text-3xl">
          {t.reviewsTitle}
        </h2>
        <p className="text-sm">
          <span className="text-coral" aria-hidden="true">
            ★
          </span>{" "}
          {fmt(t.reviewsSummary, { avg: average.toLocaleString(locale === "ru" ? "ru-RU" : "uz-UZ"), n: count })}
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {reviews.map((r) => (
          <li key={r.id} className="card p-5 text-sm">
            <p className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-coral" aria-label={`${r.rating} / 5`}>
                {"★".repeat(r.rating)}
                <span className="text-line">{"★".repeat(5 - r.rating)}</span>
              </span>
              <span className="text-xs text-muted">{formatDateISO(r.createdAt.toISOString().slice(0, 10), false, locale)}</span>
            </p>
            {r.text ? <p className="mt-2 whitespace-pre-line">{r.text}</p> : null}
            <p className="mt-2 text-xs text-muted">
              {r.authorName} · {t.verifiedPurchase}
            </p>
            {r.reply ? (
              <p className="mt-3 border-l-2 border-petal pl-3 text-charcoal/85">
                <span className="font-semibold">{t.shopReply}:</span> {r.reply}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{t.reviewsNote}</p>
    </section>
  );
}
