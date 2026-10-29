import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

/*
 * Static guards that keep future changes honest. Server actions are public HTTP endpoints: anyone can call
 * them with any arguments, so every back-office action must check the signed-in role before doing anything.
 */

function serverActions(file: string) {
  const src = fs.readFileSync(path.resolve(file), "utf8").replace(/\r\n/g, "\n");
  assert.ok(src.startsWith('"use server";'), `${file} must be a "use server" module`);
  const out: { name: string; firstStatement: string }[] = [];
  const re = /^export async function (\w+)\([^)]*\)[^{]*\{\n\s*([^\n]+)/gm;
  for (const m of src.matchAll(re)) out.push({ name: m[1], firstStatement: m[2].trim() });
  return out;
}

test("every admin server action checks the role first (only login/logout are open)", () => {
  const open = new Set(["adminLoginAction", "adminLogoutAction"]);
  const actions = serverActions("src/app/admin/actions.ts");
  assert.ok(actions.length > 20);
  for (const a of actions) {
    if (open.has(a.name)) continue;
    assert.match(a.firstStatement, /^(const \w+ = )?await require(Admin|Owner)\(\);$/, `${a.name} must start with requireAdmin()/requireOwner()`);
  }
});

test("every florist server action checks the florist session first (only the public application and logout are open)", () => {
  const open = new Set(["registerFloristAction", "floristLogoutAction"]);
  const actions = serverActions("src/app/florist/actions.ts");
  assert.ok(actions.length > 8);
  for (const a of actions) {
    if (open.has(a.name)) continue;
    assert.equal(a.firstStatement, "const me = await requireFlorist();", `${a.name} must start with requireFlorist()`);
  }
  // The florist id must always come from the session, never from the request.
  const src = fs.readFileSync(path.resolve("src/app/florist/actions.ts"), "utf8");
  assert.doesNotMatch(src, /floristId\s*[:=]\s*(Number\()?form\.get/);
  assert.doesNotMatch(src, /form\.get\(["']floristId["']\)/);
});

test("secrets stay on the server: no client component reads server-only environment variables", () => {
  const secret = /process\.env\.(?!NEXT_PUBLIC_|NODE_ENV\b)\w+/; // NODE_ENV and NEXT_PUBLIC_* are inlined at build time
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const offenders = walk(path.resolve("src"))
    .filter((f) => /\.(tsx?|jsx?)$/.test(f))
    .filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      return /^["']use client["'];/.test(src.trimStart()) && secret.test(src);
    });
  assert.deepEqual(offenders, []);
});
