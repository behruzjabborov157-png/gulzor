import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";

const COOKIE = { admin: "gz_admin", customer: "gz_sess" } as const;
const TTL_MS = { admin: 12 * 3600_000, customer: 30 * 24 * 3600_000 } as const;

type UserType = keyof typeof COOKIE;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** Compared against when the user does not exist, so response time does not reveal valid accounts. */
let dummyHash: Promise<string> | undefined;
export async function verifyAgainstDummy(password: string) {
  dummyHash ??= bcrypt.hash(randomBytes(16).toString("hex"), 12);
  await bcrypt.compare(password, await dummyHash);
  return false;
}

export async function createSession(userType: UserType, userId: string) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS[userType]);
  await db.insert(schema.sessions).values({ id: sha256(token), userType, userId, expiresAt });
  // Opportunistic cleanup of expired sessions.
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  (await cookies()).set(COOKIE[userType], token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

async function sessionUserId(userType: UserType): Promise<string | null> {
  const token = (await cookies()).get(COOKIE[userType])?.value;
  if (!token) return null;
  const db = await getDb();
  const [s] = await db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.id, sha256(token)), eq(schema.sessions.userType, userType), gt(schema.sessions.expiresAt, new Date())));
  return s?.userId ?? null;
}

export async function destroySession(userType: UserType) {
  const jar = await cookies();
  const token = jar.get(COOKIE[userType])?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  }
  jar.delete(COOKIE[userType]);
}

/**
 * Deletes a customer account (Google Play requires self-service deletion). Saved addresses and
 * favorites go with it (ON DELETE CASCADE); orders stay for the shop's records but are unlinked
 * (customer_id → NULL). Every session of the account is revoked, on all devices.
 */
export async function deleteCustomerAccount(customerId: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.sessions).where(and(eq(schema.sessions.userType, "customer"), eq(schema.sessions.userId, customerId)));
    await tx.delete(schema.customers).where(eq(schema.customers.id, customerId));
  });
}

export type AdminUser = { id: string; email: string; name: string; role: "owner" | "staff" | "florist"; floristId: number | null };

export async function getAdmin(): Promise<AdminUser | null> {
  const id = await sessionUserId("admin");
  if (!id) return null;
  const db = await getDb();
  const [a] = await db.select().from(schema.adminUsers).where(and(eq(schema.adminUsers.id, id), eq(schema.adminUsers.isActive, true)));
  return a ? { id: a.id, email: a.email, name: a.name, role: a.role, floristId: a.floristId } : null;
}

/** Server-side authorization guard for every admin page and action. Florist accounts never get into the admin area. */
export async function requireAdmin(): Promise<AdminUser> {
  const a = await getAdmin();
  if (!a) redirect("/admin/kirish");
  if (a.role === "florist") redirect("/florist");
  return a;
}

/** Guard for the florist panel: a florist user bound to a shop. Returns the user and the only florist id it may act for. */
export async function requireFlorist(): Promise<AdminUser & { floristId: number }> {
  const a = await getAdmin();
  if (!a) redirect("/admin/kirish");
  if (a.role !== "florist" || a.floristId == null) redirect("/admin");
  return { ...a, floristId: a.floristId };
}

export async function requireOwner(): Promise<AdminUser> {
  const a = await requireAdmin();
  if (a.role !== "owner") redirect("/admin?xato=ruxsat");
  return a;
}

export type Customer = { id: string; phone: string; name: string };

export async function getCustomer(): Promise<Customer | null> {
  const id = await sessionUserId("customer");
  if (!id) return null;
  const db = await getDb();
  const [c] = await db.select().from(schema.customers).where(eq(schema.customers.id, id));
  return c ? { id: c.id, phone: c.phone, name: c.name } : null;
}

/**
 * The visitor's IP, used for rate limits. Which header to trust depends on the proxy in front of the app:
 * - our nginx (deploy/nginx.conf) overwrites X-Forwarded-For with the real address → the default;
 * - a proxy that only appends to X-Forwarded-For (Render) → TRUSTED_PROXY_HOPS=n takes the n-th entry
 *   from the right, the one written by the outermost trusted proxy, so a client cannot fake it;
 * - a proxy that sets its own header (e.g. Cloudflare's CF-Connecting-IP) → CLIENT_IP_HEADER=cf-connecting-ip.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const custom = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (custom) {
    const v = h.get(custom)?.split(",")[0]?.trim();
    if (v) return v;
  }
  const xff = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 0);
  if (Number.isInteger(hops) && hops > 0 && xff.length) return xff[Math.max(0, xff.length - hops)];
  return (xff[0] || h.get("x-real-ip") || "local").trim();
}

export { rateLimit, resetRateLimit } from "@/lib/rate-limit";
