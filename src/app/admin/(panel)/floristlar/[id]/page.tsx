import Link from "next/link";
import { notFound } from "next/navigation";
import { saveFloristProfileAction, setFloristCommissionAction, setFloristStatusAction } from "@/app/admin/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { ProfileFields } from "@/components/florist/profile-fields";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPhone, formatUZS } from "@/lib/format";
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

export const metadata = { title: "Do‘kon" };

const ACTION: Record<FloristStatus, { label: string; hint: string }> = {
  approved: { label: "Tasdiqlash", hint: "Do‘kon va uning faol mahsulotlari darhol saytda ko‘rinadi." },
  suspended: { label: "To‘xtatish", hint: "Mahsulotlar saytdan yashiriladi. Ochiq buyurtmalarni florist yakunlay oladi." },
  rejected: { label: "Rad etish", hint: "Do‘kon saytda ko‘rinmaydi; florist sababni panelida ko‘radi." },
  pending: { label: "", hint: "" },
};

export default async function FloristAdminPage({ params }: { params: Promise<{ id: string }> }) {
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
          ← Do‘konlar
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl">{f.name}</h1>
          <span className={`badge ${FLORIST_STATUS_STYLE[f.status]}`}>{FLORIST_STATUS_LABEL[f.status]}</span>
          {f.isPlatform ? <span className="badge bg-plum text-ivory">Gulzor do‘koni</span> : null}
        </div>
        <p className="mt-1 text-sm text-muted">
          Ariza: {formatDateTime(f.createdAt)}
          {f.approvedAt ? ` · tasdiqlangan: ${formatDateTime(f.approvedAt)}` : ""}
          {f.status === "approved" ? (
            <>
              {" · "}
              <Link href={`/dokon/${f.slug}`} target="_blank" className="text-wine hover:underline">
                /dokon/{f.slug} ↗
              </Link>
            </>
          ) : null}
        </p>
        {f.statusReason ? <p className="mt-2 text-sm text-danger">Sabab: {f.statusReason}</p> : null}
      </div>

      {next.length ? (
        <section className="card p-6" aria-labelledby="moderation">
          <h2 id="moderation" className="mb-1 text-2xl">
            Moderatsiya
          </h2>
          <p className="mb-4 text-sm text-muted">
            Tasdiqlashdan oldin yuridik nom va STIR’ni tekshiring. Hozir: {products.active} ta faol mahsulot, {zones.active} ta faol hudud.
          </p>
          {owner ? (
            <div className="space-y-5">
              {next.map((to) => (
                <AdminForm key={to} action={setFloristStatusAction.bind(null, f.id, to)} submitLabel={ACTION[to].label}>
                  <p className="text-sm text-charcoal/85">{ACTION[to].hint}</p>
                  {NEEDS_REASON.includes(to) ? (
                    <div className="mt-2">
                      <label htmlFor={`reason-${to}`} className="label">
                        Sabab (floristga ko‘rinadi) *
                      </label>
                      <input id={`reason-${to}`} name="reason" required minLength={3} maxLength={300} className="field max-w-xl py-2 text-sm" />
                    </div>
                  ) : null}
                </AdminForm>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Do‘konni faqat sayt egasi tasdiqlashi yoki to‘xtatishi mumkin.</p>
          )}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6 text-sm" aria-labelledby="verification">
          <h2 id="verification" className="mb-3 text-2xl">
            Tekshiruv ma’lumotlari
          </h2>
          <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-muted">Yuridik nom</dt>
            <dd>{f.legalName || "—"}</dd>
            <dt className="text-muted">STIR</dt>
            <dd>{f.taxId || "—"}</dd>
            <dt className="text-muted">Telefon</dt>
            <dd>{f.phone ? <a href={`tel:${f.phone}`} className="text-wine hover:underline">{formatPhone(f.phone)}</a> : "—"}</dd>
            <dt className="text-muted">Telegram</dt>
            <dd>{f.telegramUsername ? `@${f.telegramUsername}` : "—"}</dd>
            <dt className="text-muted">Shahar</dt>
            <dd>{f.city ?? "—"}</dd>
            <dt className="text-muted">Manzil</dt>
            <dd>{f.address || "—"}</dd>
          </dl>
          <h3 className="mt-5 mb-2 text-lg">Panelga kiruvchilar</h3>
          {f.users.length ? (
            <ul className="space-y-1">
              {f.users.map((u) => (
                <li key={u.email}>
                  {u.name} · {u.email}
                  <span className="text-muted">
                    {" · "}
                    {u.lastLoginAt ? `oxirgi kirish ${formatDateTime(u.lastLoginAt)}` : "hali kirmagan"}
                    {u.isActive ? "" : " · o‘chirilgan"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{f.isPlatform ? "Gulzor do‘konini admin panel orqali boshqarasiz." : "—"}</p>
          )}
        </section>

        <section className="card p-6 text-sm" aria-labelledby="numbers">
          <h2 id="numbers" className="mb-3 text-2xl">
            Ko‘rsatkichlar
          </h2>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5">
            <dt className="text-muted">Mahsulotlar (faol / jami)</dt>
            <dd>
              {products.active} / {products.all}
            </dd>
            <dt className="text-muted">Hududlar (faol / jami)</dt>
            <dd>
              {zones.active} / {zones.all}
            </dd>
            <dt className="text-muted">Buyurtmalar (jami / ochiq)</dt>
            <dd>
              {orders.all} / {orders.open}
            </dd>
            <dt className="text-muted">Yetkazilgan</dt>
            <dd>{orders.delivered}</dd>
            <dt className="text-muted">Komissiya, shu oy</dt>
            <dd>{formatUZS(orders.commissionMonth)}</dd>
            <dt className="text-muted">Komissiya, jami</dt>
            <dd>{formatUZS(orders.commission)}</dd>
          </dl>
          <Link href={`/admin/buyurtmalar?dokon=${f.id}`} className="mt-4 inline-block text-wine hover:underline">
            Do‘kon buyurtmalari →
          </Link>
          <p className="mt-3 text-xs text-muted">Komissiya faqat «Yetkazildi» holatidagi buyurtmalardan, buyurtma paytidagi foiz bo‘yicha hisoblanadi.</p>
        </section>
      </div>

      <section className="card p-6" aria-labelledby="commission">
        <h2 id="commission" className="mb-1 text-2xl">
          Komissiya
        </h2>
        <p className="mb-4 text-sm text-muted">
          Hozir: {(f.commissionRate / 100).toLocaleString("uz-UZ")}%. O‘zgartirish faqat bundan keyingi buyurtmalarga ta’sir qiladi.
        </p>
        {owner ? (
          <AdminForm action={setFloristCommissionAction.bind(null, f.id)}>
            <label htmlFor="commission-input" className="label">
              Komissiya, %
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
          <p className="text-sm text-muted">Komissiyani faqat sayt egasi o‘zgartiradi.</p>
        )}
      </section>

      {owner ? (
        <details className="card p-6" open={f.isPlatform}>
          <summary className="cursor-pointer font-display text-2xl text-plum">Do‘kon profili</summary>
          <p className="mt-2 mb-4 text-sm text-muted">Do‘kon sahifasida mijozlarga ko‘rinadigan ma’lumotlar.</p>
          <AdminForm action={saveFloristProfileAction.bind(null, f.id)}>
            <ProfileFields shop={f} />
          </AdminForm>
        </details>
      ) : null}

      <section className="card p-6" aria-labelledby="log">
        <h2 id="log" className="mb-3 text-2xl">
          Jurnal
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
          <p className="text-sm text-muted">Hali yozuv yo‘q.</p>
        )}
      </section>
    </div>
  );
}
