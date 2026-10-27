import type { Metadata } from "next";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";
import { getCategories } from "@/lib/catalog";
import { addDaysISO, tashkentNow } from "@/lib/time";
import { CustomRequestForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDict(locale).meta;
  return { title: t.customTitle, description: t.customDescription, alternates: alternates(locale, "/maxsus-guldasta") };
}

export default async function CustomPage() {
  const locale = await getLocale();
  const t = getDict(locale).custom;
  const occasions = await getCategories("occasion", locale);
  const today = tashkentNow().date;
  return (
    <div className="container-page max-w-2xl pt-12">
      <p className="eyebrow mb-3">{t.eyebrow}</p>
      <h1 className="text-4xl sm:text-5xl">{t.title}</h1>
      <p className="mt-3 text-muted">{t.intro}</p>
      <div className="card mt-8 p-6 sm:p-8">
        <CustomRequestForm occasions={occasions.map((o) => o.name)} minDate={today} maxDate={addDaysISO(today, 90)} />
      </div>
    </div>
  );
}
