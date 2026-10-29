import Link from "next/link";
import { SubmitButton } from "@/components/admin/submit-button";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { resendEmailAction, resendTelegramAction, setOrderStatusAction, setPaymentStatusAction } from "@/app/admin/actions";
import { DeliveryEditForm } from "@/components/admin/delivery-edit-form";
import { Alert } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { formatDateISO, formatDateTime, formatPhone, formatUZS } from "@/lib/format";
import { mapLinks } from "@/lib/telegram";
import { ORDER_STATUS_LABEL, ORDER_TRANSITIONS, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, getOrderWithItems } from "@/lib/orders";

export const metadata = { title: "Buyurtma" };

const ACTION_LABEL: Record<string, string> = {
  confirmed: "Tasdiqlash",
  rejected: "Rad etish",
  cancelled: "Bekor qilish",
  preparing: "Tayyorlashni boshlash",
  ready: "Tayyor",
  dispatched: "Kuryerga berildi",
  delivered: "Yetkazildi / topshirildi",
};

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getOrderWithItems({ id });
  if (!data) notFound();
  const { order: o, items, events } = data;
  const db = await getDb();
  const [notes, pays, slots, [shop]] = await Promise.all([
    db.select().from(schema.notifications).where(eq(schema.notifications.orderId, o.id)).orderBy(desc(schema.notifications.createdAt)),
    db.select().from(schema.payments).where(eq(schema.payments.orderId, o.id)).orderBy(desc(schema.payments.createTime)),
    db.select().from(schema.timeSlots).orderBy(asc(schema.timeSlots.sortOrder)),
    db.select({ id: schema.florists.id, name: schema.florists.name }).from(schema.florists).where(eq(schema.florists.id, o.floristId)),
  ]);
  const next = ORDER_TRANSITIONS[o.status];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/admin/buyurtmalar" className="text-sm text-muted hover:text-wine">← Buyurtmalar</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl">{o.number}</h1>
          <span className="badge bg-wine text-ivory">{ORDER_STATUS_LABEL[o.status]}</span>
          <span className="badge bg-petal text-charcoal">{PAYMENT_METHOD_LABEL[o.paymentMethod]} · {PAYMENT_STATUS_LABEL[o.paymentStatus]}</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Do‘kon:{" "}
          {shop ? (
            <Link href={`/admin/floristlar/${shop.id}`} className="text-wine underline">
              {shop.name}
            </Link>
          ) : (
            "—"
          )}
          {" · "}Yaratildi: {formatDateTime(o.createdAt)} · Mijoz tili: {o.locale === "ru" ? "rus tili" : "o‘zbek tili"}
          {o.telegramUserId ? (
            <>
              {" · "}
              <a href={o.telegramUsername ? `https://t.me/${o.telegramUsername}` : `tg://user?id=${o.telegramUserId}`} className="text-wine underline">
                Telegram{o.telegramUsername ? `: @${o.telegramUsername}` : ""}
              </a>{" "}
              (Mini App orqali)
            </>
          ) : null}
        </p>
      </div>

      {o.containsDemo ? <Alert tone="warning">Buyurtmada namuna (demo) mahsulot bor — narx va tarkibni mijoz bilan tasdiqlang.</Alert> : null}

      {next.length ? (
        <section className="card p-5" aria-label="Holatni o‘zgartirish">
          <h2 className="mb-3 font-sans text-sm font-semibold">Holatni o‘zgartirish</h2>
          <div className="flex flex-wrap gap-2">
            {next.filter((s) => s !== "cancelled" && s !== "rejected").map((s) => (
              <form key={s} action={setOrderStatusAction.bind(null, o.id, s)}>
                <SubmitButton>{ACTION_LABEL[s]}</SubmitButton>
              </form>
            ))}
          </div>
          {next.some((s) => s === "cancelled" || s === "rejected") ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-danger">Bekor qilish / rad etish…</summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {next.filter((s) => s === "cancelled" || s === "rejected").map((s) => (
                  <form key={s} action={setOrderStatusAction.bind(null, o.id, s)} className="flex flex-wrap gap-2">
                    <input name="reason" placeholder="Sabab (mijozga ko‘rinadi)" className="field w-64 py-2 text-sm" maxLength={300} />
                    <SubmitButton className="btn btn-sm border border-danger text-danger hover:bg-danger/5">{ACTION_LABEL[s]}</SubmitButton>
                  </form>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Bekor qilinganda zahiradagi mahsulotlar omborga qaytariladi.</p>
            </details>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 text-sm" aria-label="Mijoz">
          <h2 className="mb-3 text-2xl">Mijoz</h2>
          <p><strong>{o.customerName}</strong> · <a href={`tel:${o.customerPhone}`} className="text-wine">{formatPhone(o.customerPhone)}</a></p>
          <p className="mt-2 text-muted">Qabul qiluvchi</p>
          <p><strong>{o.recipientName}</strong> · <a href={`tel:${o.recipientPhone}`} className="text-wine">{formatPhone(o.recipientPhone)}</a>{o.anonymous ? " · anonim" : ""}</p>
          <p className="mt-2 text-muted">{o.fulfillment === "pickup" ? "Olib ketish" : "Manzil"}</p>
          <p>{[o.regionName, o.zoneName, o.district, o.neighborhood, o.address, o.apartment && `kv. ${o.apartment}`, o.landmark && `mo‘ljal: ${o.landmark}`].filter(Boolean).join(", ")}</p>
          {o.latitude != null && o.longitude != null ? (
            <p className="mt-1">
              📍{" "}
              <a href={mapLinks(o.latitude, o.longitude).yandex} target="_blank" rel="noopener noreferrer" className="text-wine underline">
                Yandex xarita
              </a>{" "}
              ·{" "}
              <a href={mapLinks(o.latitude, o.longitude).google} target="_blank" rel="noopener noreferrer" className="text-wine underline">
                Google xarita
              </a>
            </p>
          ) : null}
          <p className="mt-2 text-muted">Sana va vaqt</p>
          <p>{formatDateISO(o.deliveryDate)}, {o.slotLabel}</p>
          {o.cardMessage ? (<><p className="mt-2 text-muted">Otkritka</p><p className="italic">“{o.cardMessage}”</p></>) : null}
          {o.courierNote ? (<><p className="mt-2 text-muted">Kuryer uchun</p><p>{o.courierNote}</p></>) : null}
        </section>

        <section className="card p-5 text-sm" aria-label="Tarkib">
          <h2 className="mb-3 text-2xl">Tarkib</h2>
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 py-2">
                <div>
                  <p>{i.productId ? <Link href={`/admin/mahsulotlar/${i.productId}`} className="hover:underline">{i.productName}</Link> : i.productName} × {i.quantity}</p>
                  <p className="text-xs text-muted">{[i.variantName, i.stems ? `${i.stems} dona` : null, i.color].filter(Boolean).join(" · ")}</p>
                  {i.addons.map((a) => <p key={a.productId} className="text-xs text-muted">+ {a.name} × {a.quantity} ({formatUZS(a.unitPrice)})</p>)}
                </div>
                <p className="shrink-0">{formatUZS(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-line pt-3">
            <div className="flex justify-between"><dt>Mahsulotlar</dt><dd>{formatUZS(o.subtotal)}</dd></div>
            {o.discount ? <div className="flex justify-between"><dt>Chegirma {o.couponCode}</dt><dd>−{formatUZS(o.discount)}</dd></div> : null}
            <div className="flex justify-between"><dt>Yetkazish</dt><dd>{formatUZS(o.deliveryFee)}</dd></div>
            {o.serviceFee ? <div className="flex justify-between"><dt>Xizmat haqi</dt><dd>{formatUZS(o.serviceFee)}</dd></div> : null}
            <div className="flex justify-between text-base font-semibold"><dt>Jami</dt><dd>{formatUZS(o.total)}</dd></div>
            <div className="flex justify-between text-xs text-muted"><dt>Gulzor komissiyasi ({(o.commissionRate / 100).toLocaleString("uz-UZ")}%)</dt><dd>{formatUZS(o.commissionAmount)}</dd></div>
          </dl>
        </section>
      </div>

      <section className="card p-5" aria-label="To‘lov">
        <h2 className="mb-3 text-2xl">To‘lov</h2>
        {o.paymentMethod === "cash" ? (
          <form action={setPaymentStatusAction.bind(null, o.id)} className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="ps">Naqd to‘lov holati:</label>
            <select id="ps" name="paymentStatus" defaultValue={o.paymentStatus} className="field w-auto py-2">
              {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <SubmitButton className="btn-secondary btn-sm">Saqlash</SubmitButton>
          </form>
        ) : (
          <p className="text-sm text-muted">Onlayn to‘lov holati faqat {PAYMENT_METHOD_LABEL[o.paymentMethod]} serveridan kelgan tasdiq orqali o‘zgaradi.</p>
        )}
        {pays.length ? (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {pays.map((p) => <li key={p.id}>{p.provider} #{p.providerTransactionId} · holat {p.state} · {formatUZS(p.amount)} · {formatDateTime(p.createTime)}</li>)}
          </ul>
        ) : null}
      </section>

      <section className="card p-5" aria-label="Yetkazib berishni tahrirlash">
        <h2 className="mb-3 text-2xl">Yetkazib berish ma’lumotlarini o‘zgartirish</h2>
        <DeliveryEditForm
          orderId={o.id}
          slots={slots.map((s) => ({ id: s.id, label: s.label }))}
          values={{
            deliveryDate: o.deliveryDate,
            slotId: o.slotId ?? 0,
            recipientName: o.recipientName,
            recipientPhone: o.recipientPhone,
            district: o.district,
            neighborhood: o.neighborhood,
            address: o.address,
            apartment: o.apartment,
            landmark: o.landmark,
            courierNote: o.courierNote,
            adminNote: o.adminNote,
          }}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 text-sm" aria-label="Tarix">
          <h2 className="mb-3 text-2xl">Tarix</h2>
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id}>
                <span className="text-muted">{formatDateTime(e.createdAt)}</span> — {e.message} <span className="text-xs text-muted">({e.actor}{e.isPublic ? ", mijozga ko‘rinadi" : ""})</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5 text-sm" aria-label="Bildirishnomalar">
          <h2 className="mb-3 text-2xl">Bildirishnomalar</h2>
          <p className="mb-3 text-xs text-muted">Buyurtma bazada saqlangan — xabar yuborilmasa ham u yo‘qolmaydi. Xatoni tuzatib, qayta yuboring.</p>
          {notes.length === 0 ? <p className="text-muted">Yozuv yo‘q.</p> : (
            <ul className="space-y-1">
              {notes.map((n) => (
                <li key={n.id}>
                  <span className="font-semibold">{n.channel === "email" ? "Email" : n.channel === "telegram-customer" ? "Mijozga (Telegram)" : "Telegram"}</span> · <span className={n.status === "sent" ? "text-success" : n.status === "failed" ? "text-danger" : "text-muted"}>{n.status === "sent" ? "Yuborildi" : n.status === "failed" ? "Xato" : "O‘tkazib yuborildi"}</span> · {formatDateTime(n.createdAt)} · {n.detail}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={resendTelegramAction.bind(null, o.id)}>
              <SubmitButton className="btn-secondary btn-sm" pendingLabel="Yuborilmoqda…">Telegram’ga qayta yuborish</SubmitButton>
            </form>
            <form action={resendEmailAction.bind(null, o.id)}>
              <SubmitButton className="btn-secondary btn-sm" pendingLabel="Yuborilmoqda…">Email’ga qayta yuborish</SubmitButton>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
