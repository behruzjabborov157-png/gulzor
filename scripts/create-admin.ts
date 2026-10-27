/**
 * Creates (or resets the password of) an admin user.
 *
 *   npm run admin:create -- --email owner@example.com --name "Ism Familiya" [--role owner|staff]
 *
 * The password is read from the ADMIN_PASSWORD environment variable or asked
 * interactively. It is never stored in plain text.
 */
import readline from "node:readline/promises";
import { loadEnv } from "./env";
loadEnv();
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { closeDb, getDb, schema } from "@/db";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim() || "Administrator";
  const role = (arg("role") ?? "owner") as "owner" | "staff";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("--email is required");
  if (!["owner", "staff"].includes(role)) throw new Error("--role must be owner or staff");

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Password (min 12 characters): ");
    rl.close();
  }
  if (!password || password.length < 12) throw new Error("Password must be at least 12 characters");

  const db = await getDb();
  const hash = await bcrypt.hash(password, 12);
  const [existing] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email));
  if (existing) {
    await db.update(schema.adminUsers).set({ passwordHash: hash, name, role, isActive: true }).where(eq(schema.adminUsers.id, existing.id));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, existing.id));
    console.log(`Updated admin ${email} (sessions revoked).`);
  } else {
    await db.insert(schema.adminUsers).values({ email, name, role, passwordHash: hash });
    console.log(`Created ${role} ${email}.`);
  }
  await closeDb();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
