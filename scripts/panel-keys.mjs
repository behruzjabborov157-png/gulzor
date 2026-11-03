/**
 * Lists every back-office text that needs a translation (used by tests/i18n.test.ts):
 *   - tt("…") in panel pages and components;
 *   - texts in constant tables of those files (menus, tabs, status names);
 *   - messages of panel server actions and of the libraries they call.
 * `node scripts/panel-keys.mjs` prints the keys missing from src/i18n/panel/{ru,en}.ts.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const PANEL_DIRS = ["src/app/admin", "src/app/florist", "src/components/admin", "src/components/florist"];
const MESSAGE_FILES = ["src/app/admin/actions.ts", "src/app/florist/actions.ts", "src/lib/florist-admin.ts", "src/lib/florist-panel.ts", "src/lib/commission.ts", "src/lib/trust.ts", "src/lib/product-save.ts"];
const LABEL_TABLES = /^(ORDER_STATUS_LABEL|PAYMENT_STATUS_LABEL|PAYMENT_METHOD_LABEL|FLORIST_STATUS_LABEL|DISPUTE_REASON_LABEL|DISPUTE_STATUS_LABEL)$/;
const LABEL_FILES = ["src/lib/orders.ts", "src/lib/florist-admin.ts", "src/lib/trust.ts"];

/** Technical strings or names that read the same in every language. */
export const isUntranslatable = (s) =>
  /^[A-Z][A-Z0-9_]+$|^\.env|^chat\.id$|^https?:|^\/|^\{\w+\}\/|^\{\w+\}$|^[a-z_-]+$|^[a-z]+[A-Z]\w*$|^max\(|^[a-z]+\|/.test(s) ||
  /^(Payme|Click|Telegram|Email|Admin|Gulzor|SEO|Slug|Premium|Google|Telegram username|pdlpad\/SOATO)$/.test(s) ||
  !/[A-Za-z‘А-Яа-я]{2}/.test(s);

const hasLetters = (s) => /[A-Za-z]{2}/.test(s);
const parse = (f) => ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const isStr = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);

export function panelKeys() {
  const keys = new Set();
  const files = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".tsx")) files.push(p);
    }
  };
  PANEL_DIRS.forEach(walk);

  for (const file of files) {
    const sf = parse(file);
    const visit = (n) => {
      const callee = ts.isCallExpression(n) ? n.expression.getText() : "";
      if (ts.isCallExpression(n) && (callee === "tt" || callee === "(await panelT())") && n.arguments[0] && isStr(n.arguments[0])) keys.add(n.arguments[0].text);
      ts.forEachChild(n, visit);
    };
    visit(sf);
    // constant tables outside components
    for (const st of sf.statements) {
      if (!ts.isVariableStatement(st)) continue;
      for (const d of st.declarationList.declarations) {
        if (/STYLE|metadata|CHILD|NAMES|PERIODS/.test(d.name.getText()) || !d.initializer) continue;
        const v = (n) => {
          if (ts.isPropertyAssignment(n) && /^(key|href|tone|owner|id|value)$/.test(n.name.getText())) return;
          if (isStr(n) && hasLetters(n.text)) keys.add(n.text);
          ts.forEachChild(n, v);
        };
        v(d.initializer);
      }
    }
  }
  for (const file of MESSAGE_FILES) {
    const sf = parse(file);
    const v = (n) => {
      // { message: "…" }, return ternaries, errors.x = "…", fail("…"), TG_ERROR-style constants
      if (ts.isPropertyAssignment(n) && n.name.getText() === "message") {
        const w = (x) => {
          if (isStr(x) && hasLetters(x.text)) keys.add(x.text);
          else if (ts.isConditionalExpression(x)) { w(x.whenTrue); w(x.whenFalse); }
          else if (ts.isParenthesizedExpression(x)) w(x.expression);
        };
        w(n.initializer);
      }
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && /errors/.test(n.left.getText()) && isStr(n.right)) keys.add(n.right.text);
      if (ts.isCallExpression(n) && /^(tt|fail|bad)$/.test(n.expression.getText()) && n.arguments[0] && isStr(n.arguments[0])) keys.add(n.arguments[0].text);
      if (ts.isVariableDeclaration(n) && /_ERROR$/.test(n.name.getText()) && n.initializer && isStr(n.initializer)) keys.add(n.initializer.text);
      ts.forEachChild(n, v);
    };
    v(sf);
  }
  for (const file of LABEL_FILES) {
    const sf = parse(file);
    const v = (n) => {
      if (ts.isVariableDeclaration(n) && LABEL_TABLES.test(n.name.getText()) && n.initializer) {
        const w = (x) => {
          if (isStr(x) && hasLetters(x.text)) keys.add(x.text);
          ts.forEachChild(x, w);
        };
        w(n.initializer);
      }
      ts.forEachChild(n, v);
    };
    v(sf);
  }
  return [...keys].filter((k) => !isUntranslatable(k)).sort();
}

if (process.argv[1]?.endsWith("panel-keys.mjs")) {
  const dict = (l) => {
    const s = fs.readFileSync(`src/i18n/panel/${l}.ts`, "utf8");
    return new Set([...s.matchAll(/^\s*("(?:[^"\\]|\\.)*"):/gm)].map((m) => JSON.parse(m[1])));
  };
  const ru = dict("ru");
  const en = dict("en");
  const keys = panelKeys();
  const missing = keys.filter((k) => !ru.has(k) || !en.has(k));
  fs.writeFileSync(process.argv[2] ?? "/dev/stdout", JSON.stringify(missing, null, 0));
  console.error(`${keys.length} keys, ${missing.length} without a translation`);
}
