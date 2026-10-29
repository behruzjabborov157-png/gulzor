import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/primitives";
import { getDb, schema } from "@/db";
import { getAdmin } from "@/lib/auth";
import { FloristRegisterForm } from "./form";

export const metadata: Metadata = {
  title: "Gulzor’da do‘kon ochish",
  description: "Gul do‘koningizni Gulzor marketpleysiga qo‘shing: ariza qoldiring, tekshiruvdan o‘ting va buyurtmalarni qabul qiling.",
};
export const dynamic = "force-dynamic";

/** Public application form for flower shops. The shop starts as "pending" and appears on the site after Gulzor approves it. */
export default async function FloristRegisterPage() {
  const me = await getAdmin();
  if (me?.role === "florist") redirect("/florist");
  const db = await getDb();
  const regions = await db
    .select({ id: schema.deliveryRegions.id, name: schema.deliveryRegions.name })
    .from(schema.deliveryRegions)
    .where(eq(schema.deliveryRegions.isActive, true))
    .orderBy(asc(schema.deliveryRegions.sortOrder));

  return (
    <div className="min-h-dvh bg-ivory">
      <header className="border-b border-line bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" aria-label="Gulzor — bosh sahifa">
            <Logo />
          </Link>
          <Link href="/admin/kirish" className="text-sm text-wine underline-offset-4 hover:underline">
            Hisobim bor — kirish
          </Link>
        </div>
      </header>
      <main className="container-page max-w-3xl py-10">
        <h1 className="text-4xl sm:text-5xl">Gulzor’da do‘kon oching</h1>
        <ul className="mt-5 space-y-2 text-sm text-charcoal/85">
          <li>• Arizani to‘ldiring — Gulzor ma’lumotlaringizni tekshiradi.</li>
          <li>• Shu orada mahsulotlar va yetkazib berish hududlarini panelda tayyorlab qo‘yasiz.</li>
          <li>• Tasdiqlangach, do‘koningiz saytda ko‘rinadi; buyurtmalarni o‘zingiz yig‘asiz va yetkazasiz, to‘lovni mijozdan o‘zingiz olasiz.</li>
          <li>• Gulzor har bir yetkazilgan buyurtmadan komissiya oladi — foiz tasdiqlash paytida kelishiladi.</li>
          <li>• Yuridik nomingiz do‘kon sahifasida sotuvchi sifatida ko‘rsatiladi; STIR faqat Gulzor tekshiruvi uchun.</li>
        </ul>
        <div className="card mt-8 p-6 sm:p-8">
          {regions.length === 0 ? (
            <p className="text-muted">Hozircha yangi do‘konlar qabul qilinmayapti.</p>
          ) : (
            <FloristRegisterForm regions={regions} />
          )}
        </div>
      </main>
    </div>
  );
}
