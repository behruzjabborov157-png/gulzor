import type { Metadata } from "next";
import { getDict } from "@/i18n/dict";
import { getLocale } from "@/i18n/server";
import { FavoritesView } from "./view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDict(await getLocale()).meta.favorites, robots: { index: false } };
}

export default async function FavoritesPage() {
  const t = getDict(await getLocale()).account;
  return (
    <div className="container-page pt-10">
      <h1 className="mb-8 text-4xl sm:text-5xl">{t.favorites}</h1>
      <FavoritesView />
    </div>
  );
}
