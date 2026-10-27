import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rasm mualliflari va litsenziyalar" };

type Credit = { file: string; title: string; author: string; license: string; source: string };

export default function CreditsPage() {
  const file = path.join(/*turbopackIgnore: true*/ process.cwd(), "public/images/demo/credits.json");
  const credits: Credit[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  return (
    <div className="container-page max-w-3xl pt-12">
      <h1 className="text-4xl">Rasm mualliflari</h1>
      <p className="mt-3 text-muted">
        Namuna katalogdagi fotosuratlar Wikimedia Commons’dan erkin litsenziyalar (CC0, ommaviy mulk, CC BY, CC BY-SA) asosida olingan va saytga moslash uchun
        qirqilgan/siqilgan. Ular haqiqiy mahsulot fotosuratlari emas. Do‘kon o‘z mahsulotlari rasmlarini yuklaganda ushbu rasmlar almashtiriladi.
      </p>
      <ul className="mt-8 divide-y divide-line text-sm">
        {credits.map((c) => (
          <li key={c.file} className="py-3">
            <a href={c.source} target="_blank" rel="noopener noreferrer" className="font-medium text-forest hover:underline">
              {c.title}
            </a>
            <p className="text-muted">
              Muallif: {c.author || "noma’lum"} · Litsenziya: {c.license}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
