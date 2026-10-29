import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireFlorist } from "@/lib/auth";
import { floristOverview } from "@/lib/florist-panel";
import { shopBotToken } from "@/lib/telegram-miniapp";

export const metadata = { title: "Bosh sahifa" };

export default async function FloristHome({ searchParams }: { searchParams: Promise<{ yangi?: string }> }) {
  const me = await requireFlorist();
  const [{ yangi }, overview, db] = await Promise.all([searchParams, floristOverview(me.floristId), getDb()]);
  const [shop] = await db.select().from(schema.florists).where(eq(schema.florists.id, me.floristId));

  const steps = [
    { done: !!shop.description && !!shop.phone, label: "Do‘kon profilini to‘ldiring (tavsif, telefon)", href: "/florist/profil" },
    { done: overview.activeZones > 0, label: "Yetkazib berish hududlari va narxlarini kiriting", href: "/florist/hududlar" },
    { done: overview.products.active > 0, label: "Kamida bitta mahsulotni rasm bilan qo‘shing (holati: faol)", href: "/florist/mahsulotlar/yangi" },
    ...(shopBotToken() ? [{ done: !!shop.telegramChatId, label: "Yangi buyurtmalar Telegram’ga kelishi uchun botni ulang", href: "/florist/profil#bildirishnomalar" }] : []),
    { done: shop.status === "approved", label: "Gulzor arizangizni tasdiqlaydi — shundan keyin do‘kon saytda ko‘rinadi", href: null },
  ];
  const cards = [
    { label: "Yangi buyurtmalar", value: overview.orders.fresh, href: "/florist/buyurtmalar?holat=new", accent: overview.orders.fresh > 0 },
    { label: "Jarayonda", value: overview.orders.active, href: "/florist/buyurtmalar" },
    { label: "Yetkazilgan", value: overview.orders.delivered, href: "/florist/hisobot" },
    { label: "Faol mahsulotlar", value: `${overview.products.active} / ${overview.products.n}`, href: "/florist/mahsulotlar" },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="text-4xl">Salom, {me.name.split(" ")[0]}!</h1>
      {yangi ? (
        <p role="status" className="mt-4 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          Arizangiz qabul qilindi. Quyidagi qadamlarni bajarib, do‘koningizni tayyorlab qo‘ying.
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`card p-5 transition hover:border-wine/40 ${c.accent ? "border-fuchsia/50" : ""}`}>
            <p className="text-sm text-muted">{c.label}</p>
            <p className={`mt-1 font-display text-4xl ${c.accent ? "text-fuchsia" : "text-plum"}`}>{c.value}</p>
          </Link>
        ))}
      </div>

      <section className="card mt-8 p-6" aria-labelledby="ready-h">
        <h2 id="ready-h" className="text-2xl">
          Do‘konni ishga tayyorlash
        </h2>
        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-start gap-3 text-sm">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.done ? "bg-success text-white" : "bg-cream text-muted"}`}
                aria-label={s.done ? "bajarildi" : "bajarilmagan"}
              >
                {s.done ? "✓" : i + 1}
              </span>
              {s.href && !s.done ? (
                <Link href={s.href} className="text-wine underline underline-offset-4">
                  {s.label}
                </Link>
              ) : (
                <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs text-muted">
          Komissiya: har bir yetkazilgan buyurtmadagi mahsulotlar summasining {(shop.commissionRate / 100).toLocaleString("uz-UZ")}% (yetkazish narxisiz).
          Mijoz to‘lovni to‘g‘ridan-to‘g‘ri sizga qiladi; komissiya oyma-oy hisoblanadi.
        </p>
      </section>
    </div>
  );
}
