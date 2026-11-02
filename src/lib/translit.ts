/**
 * Uzbek Cyrillic → Uzbek Latin (the 1995 alphabet, with ‘ in o‘ and g‘ as everywhere on the site).
 * Karakalpak letters become the Karakalpak Latin ones (á, ó, ú, ń, ı). Text without Cyrillic is returned as is,
 * apart from apostrophes in o‘/g‘ which are unified.
 */

const VOWELS = new Set("аеёиоуэюяўыәөү".split(""));

const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ч: "ch", ш: "sh", щ: "sh", ъ: "ʼ",
  ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o‘", қ: "q", ғ: "g‘", ҳ: "h",
  ә: "á", ө: "ó", ү: "ú", ң: "ń", і: "ı",
};

const isUpper = (ch: string) => ch !== ch.toLowerCase();

export function hasCyrillic(s: string): boolean {
  return /[Ѐ-ӿ]/.test(s);
}

/** Unifies o'/g' written with ' ` ’ ʻ into o‘/g‘. */
export function fixUzApostrophes(s: string): string {
  return s.replace(/([oOgG])['`’ʻ]/g, "$1‘");
}

export function cyrillicToLatin(input: string): string {
  if (!hasCyrillic(input)) return fixUzApostrophes(input);
  const chars = [...input];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const lower = ch.toLowerCase();
    const prev = (chars[i - 1] ?? " ").toLowerCase();
    const next = chars[i + 1] ?? "";
    const wordStart = !/[\p{L}ʼ’']/u.test(prev);
    let lat: string;
    if (lower === "е") lat = wordStart || VOWELS.has(prev) || prev === "ъ" || prev === "ь" ? "ye" : "e";
    else if (lower === "ц") lat = !wordStart && VOWELS.has(prev) ? "ts" : "s";
    else if (lower in MAP) lat = MAP[lower];
    else {
      out += ch;
      continue;
    }
    if (isUpper(ch) && lat) {
      // Whole word in capitals (e.g. "МФЙ") → "MFY"; otherwise only the first letter: "Ш" → "Sh".
      const wordUpper = (next && isUpper(next) && /\p{L}/u.test(next)) || (!/\p{L}/u.test(next) && i > 0 && isUpper(chars[i - 1]) && /\p{L}/u.test(chars[i - 1]));
      lat = wordUpper ? lat.toUpperCase() : lat[0].toUpperCase() + lat.slice(1);
    }
    out += lat;
  }
  return out;
}

/** Search key that matches regardless of script or apostrophes: "Чилонзор", "Chilonzor" and "chilonzor" agree. */
export function locationSearchKey(...names: (string | null | undefined)[]): string {
  return names
    .filter((n): n is string => !!n && !!n.trim())
    .map((n) => cyrillicToLatin(n))
    .join(" ")
    .toLowerCase()
    .replace(/[ʻʼ‘’'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
