/** Minimal RFC 4180 CSV parser/serializer (quoted fields, escaped quotes, CRLF, ";" auto-detect for Excel). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/)[0] ?? "";
  const sep = !firstLine.includes(",") && firstLine.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    // Prevent spreadsheet formula injection when the file is opened in Excel.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

export const PRODUCT_CSV_COLUMNS = [
  "slug",
  "name",
  "price",
  "compare_at_price",
  "status",
  "availability",
  "stock_quantity",
  "categories",
  "flower_varieties",
  "stem_count",
  "size_label",
  "short_description",
  "description",
  "care_instructions",
  "prep_time_minutes",
  "image_url",
  "is_demo",
];
