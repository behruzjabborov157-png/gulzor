import Link from "next/link";
import { Logo } from "@/components/ui/primitives";
import { localePath } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { getLocale } from "@/i18n/server";

export default async function NotFound() {
  const locale = await getLocale();
  const t = getDict(locale).common;
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <Link href={localePath(locale, "/")} aria-label={t.home}>
        <Logo />
      </Link>
      <h1 className="mt-10 text-5xl">{t.notFound.title}</h1>
      <p className="mt-3 max-w-md text-muted">{t.notFound.text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href={localePath(locale, "/katalog")} className="btn-primary">
          {t.catalog}
        </Link>
        <Link href={localePath(locale, "/")} className="btn-secondary">
          {t.home}
        </Link>
      </div>
    </div>
  );
}
