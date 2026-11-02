// Builds data/locations/uz-soato.json from a pdlpad/SOATO checkout (CC BY 4.0).
// Usage: git clone https://github.com/pdlpad/SOATO (data/ only is enough), then
//   SOURCE_COMMIT=<sha> node scripts/locations-build.mjs <SOATO checkout> data/locations/uz-soato.json
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const [repo, out] = process.argv.slice(2);
const commit = process.env.SOURCE_COMMIT ?? "";

// The source sometimes has Latin look-alike letters inside Cyrillic words (e.g. "Aндижон").
const lookalike = { A: "А", a: "а", O: "О", o: "о", E: "Е", e: "е", C: "С", c: "с", P: "Р", p: "р", X: "Х", x: "х", K: "К", M: "М", H: "Н", T: "Т", B: "В", y: "у" };
const fix = (s) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (/[Ѐ-ӿ]/.test(w) ? w.replace(/[A-Za-z]/g, (ch) => lookalike[ch] ?? ch) : w))
    .join(" ");

function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const cells = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

// Spelling fixes to the source, listed in data/locations/README.md.
const corrections = {
  "1714401+1714212": "Наманган шаҳри / Наманган тумани",
  "1718406": "Каттақўрғон шаҳри",
  "1727424": "Янгийўл шаҳри",
  "1726277": "Шайхонтоҳур тумани",
};
const round = (n) => Math.round(n * 1e5) / 1e5;
const regions = [];
const districts = [];
const mahallas = [];
const seen = new Set();
const problems = [];

for (const f of readdirSync(path.join(repo, "data/regions")).filter((f) => /^\d+\.json$/.test(f)).sort()) {
  const r = JSON.parse(readFileSync(path.join(repo, "data/regions", f), "utf8"));
  regions.push({ soato: r.soato, name: fix(r.name) });
  const dir = path.join(repo, "data/districts", r.soato);
  for (const df of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const d = JSON.parse(readFileSync(path.join(dir, df), "utf8"));
    const code = d.soato.replace(/_/g, "+");
    const points = new Map();
    const pf = path.join(repo, "data/points", r.soato, df.replace(/\.json$/, ".geojson"));
    if (existsSync(pf)) {
      for (const ft of JSON.parse(readFileSync(pf, "utf8")).features) {
        const [lng, lat] = ft.geometry.coordinates;
        points.set(String(ft.properties.mahalla_id), [round(lat), round(lng)]);
      }
    }
    const mf = path.join(repo, "data/mahallas", r.soato, df.replace(/\.json$/, ".csv"));
    const rows = existsSync(mf) ? parseCsv(readFileSync(mf, "utf8")).filter((m) => !m.quality_flags.split(";").includes("no_data")) : [];
    let sumLat = 0, sumLng = 0, n = 0;
    for (const m of rows) {
      if (seen.has(m.mahalla_id)) { problems.push(`duplicate mahalla ${m.mahalla_id}`); continue; }
      seen.add(m.mahalla_id);
      const p = points.get(m.mahalla_id) ?? null;
      if (p) { sumLat += p[0]; sumLng += p[1]; n++; }
      mahallas.push({ id: m.mahalla_id, district: code, name: fix(m.name).replace(/^«(.+)»$/, "$1"), ...(p ? { lat: p[0], lng: p[1] } : {}) });
    }
    districts.push({ soato: code, region: r.soato, name: corrections[code] ?? fix(d.name_soato), ...(n ? { lat: round(sumLat / n), lng: round(sumLng / n) } : {}) });
  }
}

const data = {
  source: {
    name: "pdlpad/SOATO — Справочник махаллей Узбекистана с привязкой к СОАТО",
    url: "https://github.com/pdlpad/SOATO",
    commit,
    license: "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)",
    note: "Names are as in the source (Uzbek / Karakalpak Cyrillic). District points are the average of their mahalla points.",
  },
  regions,
  districts,
  mahallas,
};
writeFileSync(out, JSON.stringify(data));
console.log({ regions: regions.length, districts: districts.length, mahallas: mahallas.length, withPoint: mahallas.filter((m) => m.lat).length, problems: problems.slice(0, 5), problemCount: problems.length });
const odd = new Set();
for (const x of [...regions, ...districts, ...mahallas]) for (const ch of x.name) if (!/[Ѐ-џ\s\-.,()0-9ўқғҳЎҚҒҲ’'"]/.test(ch)) odd.add(ch);
console.log("other characters:", [...odd].join(" "));
