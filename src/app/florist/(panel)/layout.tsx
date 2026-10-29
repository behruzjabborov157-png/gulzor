import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { floristLogoutAction } from "@/app/florist/actions";
import { FloristNav } from "@/components/florist/nav";
import { Logo } from "@/components/ui/primitives";
import { getDb, schema } from "@/db";
import { requireFlorist } from "@/lib/auth";
import { floristOverview } from "@/lib/florist-panel";

export const metadata: Metadata = { title: { default: "Florist paneli", template: "%s — Gulzor florist" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS_NOTE: Record<string, { tone: string; text: string }> = {
  pending: {
    tone: "border-wine/30 bg-petal/40 text-plum",
    text: "Arizangiz Gulzor tomonidan ko‘rib chiqilmoqda. Bu vaqtda mahsulot va hududlarni tayyorlab qo‘yishingiz mumkin — tasdiqlangach, ular saytda ko‘rinadi.",
  },
  suspended: { tone: "border-danger/30 bg-danger/5 text-danger", text: "Do‘koningiz vaqtincha to‘xtatilgan: mahsulotlaringiz saytda ko‘rinmaydi." },
  rejected: { tone: "border-danger/30 bg-danger/5 text-danger", text: "Arizangiz rad etildi." },
};

/** Florist panel shell. Every page below runs requireFlorist(): only a florist account bound to a shop gets in. */
export default async function FloristLayout({ children }: { children: React.ReactNode }) {
  const me = await requireFlorist();
  const db = await getDb();
  const [shop] = await db.select().from(schema.florists).where(eq(schema.florists.id, me.floristId));
  const overview = await floristOverview(me.floristId);
  const note = STATUS_NOTE[shop.status];
  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-white lg:border-r lg:border-b-0">
        <div className="lg:sticky lg:top-0 lg:max-h-dvh lg:overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 lg:block lg:py-6">
            <Link href="/florist" aria-label="Florist paneli">
              <Logo />
            </Link>
            <p className="text-xs text-muted lg:mt-2">
              {shop.name} · {me.name}
            </p>
          </div>
          <FloristNav newOrders={overview.orders.fresh} />
          <div className="flex items-center gap-4 px-5 pb-4 lg:block lg:py-4">
            {shop.status === "approved" ? (
              <Link href={`/dokon/${shop.slug}`} className="block text-sm text-muted hover:text-wine" target="_blank">
                Do‘kon sahifasi ↗
              </Link>
            ) : null}
            <form action={floristLogoutAction} className="lg:mt-3">
              <button className="text-sm text-danger hover:underline">Chiqish</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-10">
        {note ? (
          <div role="status" className={`mb-6 rounded-xl border px-4 py-3 text-sm ${note.tone}`}>
            {note.text}
            {shop.statusReason ? <span className="mt-1 block">Sabab: {shop.statusReason}</span> : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
