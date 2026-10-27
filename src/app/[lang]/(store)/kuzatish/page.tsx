import type { Metadata } from "next";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";
import { TrackForm } from "./track-form";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDict(locale).meta;
  return { title: t.trackTitle, description: t.trackDescription, alternates: alternates(locale, "/kuzatish") };
}

export default async function TrackPage() {
  const t = getDict(await getLocale()).order;
  return (
    <div className="container-page max-w-xl pt-12">
      <h1 className="text-4xl sm:text-5xl">{t.trackTitle}</h1>
      <p className="mt-3 text-muted">{t.trackIntro}</p>
      <div className="card mt-8 p-6">
        <TrackForm />
      </div>
    </div>
  );
}
