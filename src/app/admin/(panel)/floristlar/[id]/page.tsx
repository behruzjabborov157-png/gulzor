import { panelT } from "@/i18n/panel/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveFloristProfileAction, setFloristCommissionAction, setFloristStatusAction } from "@/app/admin/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { ProfileFields } from "@/components/florist/profile-fields";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPhone } from "@/lib/format";
import {
  describeAudit,
  FLORIST_STATUS_LABEL,
  FLORIST_STATUS_STYLE,
  FLORIST_STATUS_TRANSITIONS,
  floristAdminDetail,
  MAX_COMMISSION_BP,
  NEEDS_REASON,
} from "@/lib/florist-admin";
import type { FloristStatus } from "@/lib/florists";

export async function generateMetadata() {
  return { title: (await panelT())("Do‘kon") };
}

const ACTION: Record<FloristStatus, { label: string; hint: string }> = {
  approved: { label: "Tasdiqlash", hint: "Do‘kon va uning faol mahsulotlari darhol saytda ko‘rinadi." },
  suspended: { label: "To‘xtatish", hint: "Mahsulotlar saytdan yashiriladi. Ochiq buyurtmalarni florist yakunlay oladi." },
  rejected: { label: "Rad etish", hint: "Do‘kon saytda ko‘rinmaydi; florist sababni panelida ko‘radi." },
  pending: { label: "", hint: "" },
};

export default async function FloristAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const tt = await panelT();
  const admin = await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const f = await floristAdminDetail(id);
  if (!f) notFound();
  const owner = admin.role === "owner";
  const next = f.isPlatform ? [] : FLORIST_STATUS_TRANSITIONS[f.status];
  const { products, zones, orders } = f.stats;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/admin/floristlar" className="text-sm text-muted hover:text-wine">
          {tt("← Do‘konlar")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl">{f.name}</h1>
          <span className={`badge ${FLORIST_STATUS_STYLE[f.status]}`}>{tt(FLORIST_STATUS_LABEL[f.status])}</span>
          {f.isPlatform ? <span className="badge bg-plum text-ivory">{tt("Gulzor do‘koni")}</span> : null}
        </div>
        <p className="mt-1 text-sm text-muted">
          {tt("Ariza:")}{" "}{formatDateTime(f.createdAt)}
          {f.approvedAt ? tt(" · tasdiqlangan: {p}", { p: formatDateTime(f.approvedAt) }) : ""}
          {f.status === "approved" ? (
            <>
              {" · "}
              <Link href={`/dokon/${f.slug}`} target="_blank" className="text-wine hover:underline">{tt("/dokon/{slug} ↗", { slug: f.slug })}</Link>
            </>
          ) : null}
        </p>
        {f.statusReason ? <p className="mt-2 text-sm text-danger">{tt("Sabab: {statusReason}", { statusReason: f.statusReason })}</p> : null}
      </div>

      {next.length ? (
        <section className="card p-6" aria-labelledby="moderation">
          <h2 id="moderation" className="mb-1 text-2xl">
            {tt("Moderatsiya")}
          </h2>
          <p className="mb-4 text-sm text-muted">{tt("Tasdiqlashdan oldin yuridik nom va STIR’ni tekshiring. Hozir: {active} ta faol mahsulot, {active2} ta faol hudud.", { active: products.active, active2: zones.active })}</p>
          {owner ? (
            <div className="space-y-5">
              {next.map((to) => (
                <AdminForm key={to} action={setFloristStatusAction.bind(null, f.id, to)} submitLabel={tt(ACTION[to].label)}>
                  <p className="text-sm text-charcoal/85">{tt(ACTION[to].hint)}</p>
                  {NEEDS_REASON.includes(to) ? (
                    <div className="mt-2">
                      <label htmlFor={`reason-${to}`} className="label">
                        {tt("Sabab (floristga ko‘rinadi) *")}
                      </label>
                      <input id={`reason-${to}`} name="reason" required minLength={3} maxLength={300} className="field max-w-xl py-2 text-sm" />
                    </div>
                  ) : null}
                </AdminForm>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{tt("Do‘konni faqat sayt egasi tasdiqlashi yoki to‘xtatishi mumkin.")}</p>
          )}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6 text-sm" aria-labelledby="verification">
          <h2 id="verification" className="mb-3 text-2xl">
            {tt("Tekshiruv ma’lumotlari")}
          </h2>
          <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-muted">{tt("Yuridik nom")}</dt>
            <dd>{f.legalName || "—"}</dd>
            <dt className="text-muted">{tt("STIR")}</dt>
            <dd>{f.taxId || "—"}</dd>
            <dt className="text-muted">{tt("Telefon")}</dt>
            <dd>{f.phone ? <a href={`tel:${f.phone}`} className="text-wine hover:underline">{formatPhone(f.phone)}</a> : "—"}</dd>
            <dt className="text-muted">{tt("Telegram")}</dt>
            <dd>{f.telegramUsername ? `@${f.telegramUsername}` : "—"}</dd>
            <dt className="text-muted">{tt("Shahar")}</dt>
            <dd>{f.city ?? "—"}</dd>
            <dt className="text-muted">{tt("Manzil")}</dt>
            <dd>{f.address || "—"}</dd>
          </dl>
          <h3 className="mt-5 mb-2 text-lg">{tt("Panelga kiruvchilar")}</h3>
          {f.users.length ? (
            <ul className="space-y-1">
              {f.users.map((u) => (
                <li key={u.email}>
                  {u.name} · {u.email}
                  <span className="text-muted">
                    {" · "}
                    {u.lastLoginAt ? tt("oxirgi kirish {p}", { p: formatDateTime(u.lastLoginAt) }) : tt("hali kirmagan")}
                    {u.isActive ? "" : tt(" · o‘chirilgan")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{f.isPlatform ? tt("Gulzor do‘konini admin panel orqali boshqarasiz.") : "—"}</p>
          )}
        </section>

        <section className="card p-6 text-sm" aria-labelledby="numbers">
          <h2 id="numbers" className="mb-3 text-2xl">
            {tt("Ko‘rsatkichlar")}
          </h2>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5">
            <dt className="text-muted">{tt("Mahsulotlar (faol / jami)")}</dt>
            <dd>
              {products.active} / {products.all}
            </dd>
            <dt className="text-muted">{tt("Hududlar (faol / jami)")}</dt>
            <dd>
              {zones.active} / {zones.all}
            </dd>
            <dt className="text-muted">{tt("Buyurtmalar (jami / ochiq)")}</dt>
            <dd>
              {orders.all} / {orders.open}
            </dd>
            <dt className="text-muted">{tt("Yetkazilgan")}</dt>
            <dd>{orders.delivered}</dd>
            <dt className="text-muted">{tt("Komissiya, shu oy")}</dt>
            <dd>{tt.uzs(orders.commissionMonth)}</dd>
            <dt className="text-muted">{tt("Komissiya, jami")}</dt>
            <dd>{tt.uzs(orders.commission)}</dd>
          </dl>
          <Link href={`/admin/buyurtmalar?dokon=${f.id}`} className="mt-4 inline-block text-wine hover:underline">
            {tt("Do‘kon buyurtmalari →")}
          </Link>
          <p className="mt-3 text-xs text-muted">{tt("Komissiya faqat «Yetkazildi» holatidagi buyurtmalardan, buyurtma paytidagi foiz bo‘yicha hisoblanadi.")}</p>
        </section>
      </div>

      <section className="card p-6" aria-labelledby="commission">
        <h2 id="commission" className="mb-1 text-2xl">
          {tt("Komissiya")}
        </h2>
        <p className="mb-4 text-sm text-muted">{tt("Hozir: {p}%. O‘zgartirish faqat bundan keyingi buyurtmalarga ta’sir qiladi.", { p: (f.commissionRate / 100).toLocaleString("uz-UZ") })}</p>
        {owner ? (
          <AdminForm action={setFloristCommissionAction.bind(null, f.id)}>
            <label htmlFor="commission-input" className="label">
              {tt("Komissiya, %")}
            </label>
            <input
              id="commission-input"
              name="commission"
              type="number"
              min={0}
              max={MAX_COMMISSION_BP / 100}
              step={0.1}
              defaultValue={f.commissionRate / 100}
              required
              className="field max-w-[10rem] py-2"
            />
          </AdminForm>
        ) : (
          <p className="text-sm text-muted">{tt("Komissiyani faqat sayt egasi o‘zgartiradi.")}</p>
        )}
      </section>

      {owner ? (
        <details className="card p-6" open={f.isPlatform}>
          <summary className="cursor-pointer font-display text-2xl text-plum">{tt("Do‘kon profili")}</summary>
          <p className="mt-2 mb-4 text-sm text-muted">{tt("Do‘kon sahifasida mijozlarga ko‘rinadigan ma’lumotlar.")}</p>
          <AdminForm action={saveFloristProfileAction.bind(null, f.id)}>
            <ProfileFields shop={f} />
          </AdminForm>
        </details>
      ) : null}

      <section className="card p-6" aria-labelledby="log">
        <h2 id="log" className="mb-3 text-2xl">
          {tt("Jurnal")}
        </h2>
        {f.log.length ? (
          <ol className="space-y-2 text-sm">
            {f.log.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-3">
                <span className="text-muted">{formatDateTime(e.createdAt)}</span>
                <span>{describeAudit(e)}</span>
                <span className="text-muted">{e.actorEmail}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">{tt("Hali yozuv yo‘q.")}</p>
        )}
      </section>
    </div>
  );
}
