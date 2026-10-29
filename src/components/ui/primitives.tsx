import Image from "next/image";
import Link from "next/link";
import { fmt, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { formatUZS } from "@/lib/format";
import { FlowerIcon } from "./icons";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex items-baseline gap-1 font-display text-[1.7rem] leading-none font-semibold ${light ? "text-ivory" : "text-wine"}`}>
      Gulzor
      <span className={`h-1.5 w-1.5 rounded-full ${light ? "bg-coral" : "bg-fuchsia"}`} aria-hidden="true" />
    </span>
  );
}

export function Price({
  value,
  compareAt,
  from,
  className = "",
  locale = "uz",
  dark = false,
}: {
  value: number;
  compareAt?: number | null;
  from?: boolean;
  className?: string;
  locale?: Locale;
  /** On dark (plum) backgrounds. */
  dark?: boolean;
}) {
  const t = getDict(locale).common;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className={`font-semibold ${dark ? "text-petal" : compareAt && compareAt > value ? "text-cherry" : "text-wine"}`}>{from ? fmt(t.priceFrom, { price: formatUZS(value, locale) }) : formatUZS(value, locale)}</span>
      {compareAt && compareAt > value ? (
        <s className={`text-sm ${dark ? "text-ivory/60" : "text-muted"}`} aria-label={fmt(t.oldPrice, { price: formatUZS(compareAt, locale) })}>
          {formatUZS(compareAt, locale)}
        </s>
      ) : null}
    </span>
  );
}

/** Product photo with an elegant fallback when no image is uploaded yet. */
export function ProductImage({
  src,
  alt,
  sizes,
  priority,
  className = "",
  locale = "uz",
}: {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  locale?: Locale;
}) {
  if (!src) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-petal/50 text-wine/60 ${className}`} role="img" aria-label={alt}>
        <FlowerIcon size={40} />
        <span className="text-xs">{getDict(locale).common.photoSoon}</span>
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  linkLabel,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" data-reveal>
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
        <h2 className="text-[2.2rem] leading-[1.02] text-plum sm:text-5xl">{title}</h2>
        {description ? <p className="mt-2 text-muted">{description}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="group/link inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-wine underline-offset-4 hover:underline">
          {linkLabel} <span aria-hidden="true" className="transition-transform duration-300 group-hover/link:translate-x-1">→</span>
        </Link>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-petal/60 text-wine">
        <FlowerIcon size={28} />
      </div>
      <h2 className="text-2xl">{title}</h2>
      {text ? <p className="mt-2 max-w-md text-muted">{text}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Breadcrumbs({ items, label }: { items: { href?: string; label: string }[]; label: string }) {
  return (
    <nav aria-label={label} className="mb-6 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {it.href ? (
              <Link href={it.href} className="hover:text-wine">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-charcoal">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: React.ReactNode }) {
  const styles = {
    info: "border-sage bg-sage-light/60 text-wine",
    error: "border-danger/30 bg-danger/5 text-danger",
    success: "border-success/30 bg-success/5 text-success",
    warning: "border-petal-deep bg-petal/40 text-charcoal",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}
