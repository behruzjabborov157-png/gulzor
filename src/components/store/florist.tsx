import Link from "next/link";
import { CheckIcon } from "@/components/ui/icons";
import { localePath, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";

/** "Sold by <shop> ✓ verified" — links to the shop's public page. */
export function FloristLink({ florist, locale, compact = false }: { florist: { slug: string; name: string }; locale: Locale; compact?: boolean }) {
  const t = getDict(locale).shop;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 ${compact ? "text-[12px]" : "text-sm"}`}>
      {compact ? null : <span className="text-muted">{t.soldBy}</span>}
      <Link href={localePath(locale, `/dokon/${florist.slug}`)} className="font-semibold text-wine underline-offset-4 hover:underline">
        {florist.name}
      </Link>
      <span className="inline-flex items-center gap-1 text-success" title={t.verifiedHint}>
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success/10">
          <CheckIcon size={11} />
        </span>
        {compact ? <span className="sr-only">{t.verified}</span> : <span className="text-xs">{t.verified}</span>}
      </span>
    </span>
  );
}
