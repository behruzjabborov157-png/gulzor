/** Translation completeness: same keys, no empty strings, same {placeholders}, and English text is really English. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fmt, LOCALES, localePath, pick, pickAt, pickList, splitLocale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { BOT_TEXTS } from "@/lib/bot/texts";
import { formatDateISO, formatUZS } from "@/lib/format";
import { makeT, panelDict } from "@/i18n/panel/core";
import { panelKeys } from "../scripts/panel-keys.mjs";

type Tree = { [k: string]: unknown };

function leaves(node: unknown, path = ""): [string, string][] {
  if (typeof node === "string") return [[path, node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (node && typeof node === "object") return Object.entries(node as Tree).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const sets = [
  { name: "site", of: (l: (typeof LOCALES)[number]) => getDict(l) as unknown },
  { name: "bot", of: (l: (typeof LOCALES)[number]) => BOT_TEXTS[l] as unknown },
];

for (const { name, of } of sets) {
  test(`${name} dictionary: every language has every key, with the same placeholders`, () => {
    const base = new Map(leaves(of("uz")));
    assert.ok(base.size > 100);
    for (const locale of LOCALES) {
      const own = new Map(leaves(of(locale)));
      assert.deepEqual([...own.keys()].sort(), [...base.keys()].sort(), `${locale}: keys differ`);
      for (const [key, text] of own) {
        assert.ok(text.trim() || !base.get(key)!.trim(), `${locale}.${key} is empty`);
        assert.deepEqual(placeholders(text), placeholders(base.get(key)!), `${locale}.${key}: placeholders differ`);
      }
    }
  });

  test(`${name} dictionary: English has no Cyrillic text left`, () => {
    // The language prompt deliberately shows all three languages.
    const bad = leaves(of("en")).filter(([k, v]) => /[Ѐ-ӿ]/.test(v) && k !== "chooseLanguage");
    assert.deepEqual(bad, []);
  });
}

test("language routing helpers", () => {
  assert.equal(localePath("en", "/katalog"), "/en/katalog");
  assert.equal(localePath("en", "/"), "/en");
  assert.equal(localePath("uz", "/katalog"), "/katalog");
  assert.deepEqual(splitLocale("/en/gul/atirgul"), { locale: "en", path: "/gul/atirgul" });
  assert.deepEqual(splitLocale("/en"), { locale: "en", path: "/" });
  assert.deepEqual(splitLocale("/english-roses"), { locale: "uz", path: "/english-roses" });
});

test("admin-entered text falls back to Uzbek when a translation is empty", () => {
  assert.equal(pick("en", "Atirgul", "Роза", "Rose"), "Rose");
  assert.equal(pick("en", "Atirgul", "Роза", " "), "Atirgul");
  assert.equal(pick("en", "Atirgul", "Роза"), "Atirgul");
  assert.equal(pick("ru", "Atirgul", "Роза", "Rose"), "Роза");
  assert.equal(pick("uz", "Atirgul", "Роза", "Rose"), "Atirgul");
  assert.deepEqual(pickList("en", ["Qizil"], ["Красный"], []), ["Qizil"]);
  assert.deepEqual(pickList("en", ["Qizil"], ["Красный"], ["Red"]), ["Red"]);
  assert.equal(pickAt("en", 1, ["Qizil", "Oq"], [], ["Red"]), "Oq");
  assert.equal(pickAt("en", 0, ["Qizil", "Oq"], [], ["Red"]), "Red");
});

test("money and dates follow the language", () => {
  assert.equal(formatUZS(149_000, "en").replace(/ /g, " "), "149,000 UZS");
  assert.equal(formatUZS(1_250_000, "en").replace(/ /g, " "), "1,250,000 UZS");
  assert.equal(formatDateISO("2026-10-26", true, "en"), "Monday, 26 October");
  assert.equal(formatDateISO("2026-10-26", false, "en"), "26 October");
  assert.equal(fmt(getDict("en").common.priceFrom, { price: "1" }), "from 1");
});

test("admin and florist panels: every text in the code has Russian and English, with the same placeholders", () => {
  const keys = panelKeys();
  assert.ok(keys.length > 600);
  for (const locale of ["ru", "en"] as const) {
    const dict = panelDict(locale);
    assert.deepEqual(keys.filter((k) => !dict[k]), [], `${locale}: missing translations`);
    for (const [k, v] of Object.entries(dict)) assert.deepEqual(placeholders(v), placeholders(k), `${locale}: ${k}`);
  }
  const cyrillic = Object.entries(panelDict("en")).filter(([k, v]) => /[Ѐ-ӿ]/.test(v) && !/[Ѐ-ӿ]/.test(k));
  assert.deepEqual(cyrillic, []);
});

test("panel translator: known text, parameters, unknown text and formatting", () => {
  const t = makeT(panelDict("en"), "en");
  assert.equal(t("Buyurtmalar"), "Orders");
  assert.equal(t("Salom, {name}", { name: "Ali" }), "Hello, Ali");
  assert.equal(t("Mijoz yozgan matn"), "Mijoz yozgan matn");
  assert.equal(t.uzs(1000).replace(/ /g, " "), "1,000 UZS");
  assert.equal(makeT(panelDict("uz"))("Buyurtmalar"), "Buyurtmalar");
});
