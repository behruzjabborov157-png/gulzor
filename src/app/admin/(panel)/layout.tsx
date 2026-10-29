import type { Metadata } from "next";
import Link from "next/link";
import { adminLogoutAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/nav";
import { Logo } from "@/components/ui/primitives";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s — Gulzor admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  // Orders nobody has looked at yet (status "new"), shown as a badge in the menu.
  const db = await getDb();
  const [[{ n: newOrders }], [{ n: pendingShops }]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(schema.orders).where(eq(schema.orders.status, "new")),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.florists).where(eq(schema.florists.status, "pending")),
  ]);
  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-white lg:border-r lg:border-b-0">
        <div className="lg:sticky lg:top-0 lg:max-h-dvh lg:overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 lg:block lg:py-6">
            <Link href="/admin" aria-label="Admin bosh sahifa"><Logo /></Link>
            <p className="text-xs text-muted lg:mt-2">{admin.name} · {admin.role === "owner" ? "Egasi" : "Xodim"}</p>
          </div>
          <AdminNav owner={admin.role === "owner"} newOrders={newOrders} pendingShops={pendingShops} />
          <div className="flex items-center gap-4 px-5 pb-4 lg:block lg:py-4">
            <Link href="/" className="block text-sm text-muted hover:text-wine" target="_blank">Saytni ochish ↗</Link>
            <form action={adminLogoutAction} className="lg:mt-3">
              <button className="text-sm text-danger hover:underline">Chiqish</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
