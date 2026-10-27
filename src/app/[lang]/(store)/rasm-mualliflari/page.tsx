import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { fmt } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: getDict(locale).meta.credits, alternates: alternates(locale, "/rasm-mualliflari") };
}

type Credit = { file: string; title: string; author: string; license: string; source: string };

export default async function CreditsPage() {
  const t = getDict(await getLocale()).common.credits;
  const file = path.join(/*turbopackIgnore: true*/ process.cwd(), "public/images/demo/credits.json");
  const credits: Credit[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  return (
    <div className="container-page max-w-3xl pt-12">
      <h1 className="text-4xl">{t.title}</h1>
      <p className="mt-3 text-muted">{t.intro}</p>
      <ul className="mt-8 divide-y divide-line text-sm">
        {credits.map((c) => (
          <li key={c.file} className="py-3">
            <a href={c.source} target="_blank" rel="noopener noreferrer" className="font-medium text-forest hover:underline">
              {c.title}
            </a>
            <p className="text-muted">{fmt(t.author, { author: c.author || t.unknown, license: c.license })}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
