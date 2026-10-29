import { eq } from "drizzle-orm";
import { floristSaveProfileAction, floristUnlinkTelegramAction } from "@/app/florist/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { ProfileFields } from "@/components/florist/profile-fields";
import { getDb, schema } from "@/db";
import { requireFlorist } from "@/lib/auth";
import { floristTelegramLink } from "@/lib/florist-notify";

export const metadata = { title: "Do‘kon profili" };

export default async function FloristProfilePage() {
  const me = await requireFlorist();
  const db = await getDb();
  const [shop] = await db.select().from(schema.florists).where(eq(schema.florists.id, me.floristId));
  const tgLink = shop.telegramChatId ? null : await floristTelegramLink(me.floristId);
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-4xl">Do‘kon profili</h1>
      <p className="text-sm text-muted">
        Bu ma’lumotlar do‘kon sahifangizda (/dokon/{shop.slug}) mijozlarga ko‘rinadi. Yuridik nom va STIR’ni o‘zgartirish uchun Gulzor bilan bog‘laning.
      </p>
      <section className="card p-6">
        <AdminForm action={floristSaveProfileAction}>
          <ProfileFields shop={shop} />
        </AdminForm>
      </section>
      <section id="bildirishnomalar" className="card scroll-mt-6 p-6 text-sm" aria-labelledby="notify-h">
        <h2 id="notify-h" className="mb-2 text-2xl">
          Bildirishnomalar
        </h2>
        <p className="text-muted">Yangi buyurtmalar, Gulzor buyurtmangizga kiritgan o‘zgarishlar va komissiya hisoblari shu yerga keladi.</p>
        <div className="mt-4 space-y-3">
          <div>
            <p className="font-semibold">Telegram</p>
            {shop.telegramChatId ? (
              <form action={floristUnlinkTelegramAction} className="mt-1 flex flex-wrap items-center gap-3">
                <span className="text-success">Ulangan</span>
                <button className="text-danger hover:underline">Uzish</button>
              </form>
            ) : tgLink ? (
              <p className="mt-1">
                <a href={tgLink} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">
                  Telegram’ni ulash
                </a>
                <span className="mt-2 block text-muted">Bot ochilgach «Start»ni bosing. Havola bir martalik — boshqalarga bermang.</span>
              </p>
            ) : (
              <p className="mt-1 text-muted">Gulzor Telegram botini hali sozlamagan.</p>
            )}
          </div>
          <div>
            <p className="font-semibold">Email</p>
            <p className="mt-1 text-muted">
              {process.env.SMTP_HOST ? `Panelga kirish emailingizga (${me.email}) yuboriladi.` : "Email yuborish hali sozlanmagan."}
            </p>
          </div>
        </div>
      </section>
      <section className="card p-6 text-sm">
        <h2 className="mb-2 text-2xl">Tekshiruv ma’lumotlari</h2>
        <p>Yuridik nom: {shop.legalName || "—"}</p>
        <p>STIR: {shop.taxId || "—"}</p>
        <p>Komissiya: {(shop.commissionRate / 100).toLocaleString("uz-UZ")}%</p>
      </section>
    </div>
  );
}
