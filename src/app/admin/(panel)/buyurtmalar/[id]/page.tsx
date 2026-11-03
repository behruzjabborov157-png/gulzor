import { panelT } from "@/i18n/panel/server";
import { LANGUAGE_NAME_UZ } from "@/i18n/config";
import Link from "next/link";
import { SubmitButton } from "@/components/admin/submit-button";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { adminOrderPhotoAction, resendEmailAction, resendTelegramAction, setOrderStatusAction, setPaymentStatusAction } from "@/app/admin/actions";
import { OrderPhotos } from "@/components/admin/order-photos";
import { DeliveryEditForm } from "@/components/admin/delivery-edit-form";
import { Alert } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPhone } from "@/lib/format";
import { mapLinks } from "@/lib/telegram";
import { DISPUTE_REASON_LABEL, DISPUTE_STATUS_LABEL, orderDisputes, orderPhotos } from "@/lib/trust";
import { ORDER_STATUS_LABEL, ORDER_TRANSITIONS, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, getOrderWithItems } from "@/lib/orders";

export async function generateMetadata() {
  return { title: (await panelT())("Buyurtma") };
}

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
  const tt = await panelT();
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getOrderWithItems({ id });
  if (!data) notFound();
  const { order: o, items, events } = data;
  const db = await getDb();
  const [notes, pays, slots, [shop], photos, disputes] = await Promise.all([
    db.select().from(schema.notifications).where(eq(schema.notifications.orderId, o.id)).orderBy(desc(schema.notifications.createdAt)),
    db.select().from(schema.payments).where(eq(schema.payments.orderId, o.id)).orderBy(desc(schema.payments.createTime)),
    db.select().from(schema.timeSlots).orderBy(asc(schema.timeSlots.sortOrder)),
    db.select({ id: schema.florists.id, name: schema.florists.name }).from(schema.florists).where(eq(schema.florists.id, o.floristId)),
    orderPhotos(o.id),
    orderDisputes(o.id),
  ]);
  const next = ORDER_TRANSITIONS[o.status];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/admin/buyurtmalar" className="text-sm text-muted hover:text-wine">{tt("← Buyurtmalar")}</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl">{o.number}</h1>
          <span className="badge bg-wine text-ivory">{tt(ORDER_STATUS_LABEL[o.status])}</span>
          <span className="badge bg-petal text-charcoal">{tt(PAYMENT_METHOD_LABEL[o.paymentMethod])} · {tt(PAYMENT_STATUS_LABEL[o.paymentStatus])}</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {tt("Do‘kon:")}{" "}
          {shop ? (
            <Link href={`/admin/floristlar/${shop.id}`} className="text-wine underline">
              {shop.name}
            </Link>
          ) : (
            "—"
          )}
          {" · "}{tt("Yaratildi:")}{" "}{formatDateTime(o.createdAt)}{" "}{tt("· Mijoz tili:")}{" "}{LANGUAGE_NAME_UZ[o.locale] ?? o.locale}
          {o.telegramUserId ? (
            <>
              {" · "}
              <a href={o.telegramUsername ? `https://t.me/${o.telegramUsername}` : `tg://user?id=${o.telegramUserId}`} className="text-wine underline">{tt("Telegram{p}", { p: o.telegramUsername ? `: @${o.telegramUsername}` : "" })}</a>{" "}
              {tt("(Mini App orqali)")}
            </>
          ) : null}
        </p>
      </div>

      {o.containsDemo ? <Alert tone="warning">{tt("Buyurtmada namuna (demo) mahsulot bor — narx va tarkibni mijoz bilan tasdiqlang.")}</Alert> : null}

      {next.length ? (
        <section className="card p-5" aria-label={tt("Holatni o‘zgartirish")}>
          <h2 className="mb-3 font-sans text-sm font-semibold">{tt("Holatni o‘zgartirish")}</h2>
          <div className="flex flex-wrap gap-2">
            {next.filter((s) => s !== "cancelled" && s !== "rejected").map((s) => (
              <form key={s} action={setOrderStatusAction.bind(null, o.id, s)}>
                <SubmitButton>{tt(ACTION_LABEL[s])}</SubmitButton>
              </form>
            ))}
          </div>
          {next.some((s) => s === "cancelled" || s === "rejected") ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-danger">{tt("Bekor qilish / rad etish…")}</summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {next.filter((s) => s === "cancelled" || s === "rejected").map((s) => (
                  <form key={s} action={setOrderStatusAction.bind(null, o.id, s)} className="flex flex-wrap gap-2">
                    <input name="reason" placeholder={tt("Sabab (mijozga ko‘rinadi)")} className="field w-64 py-2 text-sm" maxLength={300} />
                    <SubmitButton className="btn btn-sm border border-danger text-danger hover:bg-danger/5">{tt(ACTION_LABEL[s])}</SubmitButton>
                  </form>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">{tt("Bekor qilinganda zahiradagi mahsulotlar omborga qaytariladi.")}</p>
            </details>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 text-sm" aria-label={tt("Mijoz")}>
          <h2 className="mb-3 text-2xl">{tt("Mijoz")}</h2>
          <p><strong>{o.customerName}</strong> · <a href={`tel:${o.customerPhone}`} className="text-wine">{formatPhone(o.customerPhone)}</a></p>
          <p className="mt-2 text-muted">{tt("Qabul qiluvchi")}</p>
          <p><strong>{o.recipientName}</strong> · <a href={`tel:${o.recipientPhone}`} className="text-wine">{formatPhone(o.recipientPhone)}</a>{o.anonymous ? tt(" · anonim") : ""}</p>
          <p className="mt-2 text-muted">{o.fulfillment === "pickup" ? tt("Olib ketish") : tt("Manzil")}</p>
          <p>{[o.regionName, o.zoneName, o.district, o.neighborhood, o.address, o.apartment && tt("kv. {apartment}", { apartment: o.apartment }), o.landmark && tt("mo‘ljal: {landmark}", { landmark: o.landmark })].filter(Boolean).join(", ")}</p>
          {o.latitude != null && o.longitude != null ? (
            <p className="mt-1">
              📍{" "}
              <a href={mapLinks(o.latitude, o.longitude).yandex} target="_blank" rel="noopener noreferrer" className="text-wine underline">
                {tt("Yandex xarita")}
              </a>{" "}
              ·{" "}
              <a href={mapLinks(o.latitude, o.longitude).google} target="_blank" rel="noopener noreferrer" className="text-wine underline">
                {tt("Google xarita")}
              </a>
            </p>
          ) : null}
          <p className="mt-2 text-muted">{tt("Sana va vaqt")}</p>
          <p>{tt.date(o.deliveryDate)}, {o.slotLabel}</p>
          {o.cardMessage ? (<><p className="mt-2 text-muted">{tt("Otkritka")}</p><p className="italic">“{o.cardMessage}”</p></>) : null}
          {o.courierNote ? (<><p className="mt-2 text-muted">{tt("Kuryer uchun")}</p><p>{o.courierNote}</p></>) : null}
        </section>

        <section className="card p-5 text-sm" aria-label={tt("Tarkib")}>
          <h2 className="mb-3 text-2xl">{tt("Tarkib")}</h2>
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 py-2">
                <div>
                  <p>{i.productId ? <Link href={`/admin/mahsulotlar/${i.productId}`} className="hover:underline">{i.productName}</Link> : i.productName} × {i.quantity}</p>
                  <p className="text-xs text-muted">{[i.variantName, i.stems ? `${i.stems} dona` : null, i.color].filter(Boolean).join(" · ")}</p>
                  {i.addons.map((a) => <p key={a.productId} className="text-xs text-muted">+ {a.name} × {a.quantity} ({tt.uzs(a.unitPrice)})</p>)}
                </div>
                <p className="shrink-0">{tt.uzs(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-line pt-3">
            <div className="flex justify-between"><dt>{tt("Mahsulotlar")}</dt><dd>{tt.uzs(o.subtotal)}</dd></div>
            {o.discount ? <div className="flex justify-between"><dt>{tt("Chegirma {couponCode}", { couponCode: o.couponCode })}</dt><dd>−{tt.uzs(o.discount)}</dd></div> : null}
            <div className="flex justify-between"><dt>{tt("Yetkazish")}</dt><dd>{tt.uzs(o.deliveryFee)}</dd></div>
            {o.serviceFee ? <div className="flex justify-between"><dt>{tt("Xizmat haqi")}</dt><dd>{tt.uzs(o.serviceFee)}</dd></div> : null}
            <div className="flex justify-between text-base font-semibold"><dt>{tt("Jami")}</dt><dd>{tt.uzs(o.total)}</dd></div>
            <div className="flex justify-between text-xs text-muted"><dt>{tt("Gulzor komissiyasi ({p}%)", { p: (o.commissionRate / 100).toLocaleString("uz-UZ") })}</dt><dd>{tt.uzs(o.commissionAmount)}</dd></div>
          </dl>
        </section>
      </div>

      {disputes.length ? (
        <section className="card p-5 text-sm" aria-label={tt("Murojaatlar")}>
          <h2 className="mb-3 text-2xl">{tt("Murojaatlar")}</h2>
          <ul className="space-y-2">
            {disputes.map((d) => (
              <li key={d.id}>
                <b>{tt(DISPUTE_REASON_LABEL[d.reason])}</b> · {tt(DISPUTE_STATUS_LABEL[d.status])} · {formatDateTime(d.createdAt)} — {d.message}
              </li>
            ))}
          </ul>
          <Link href="/admin/murojaatlar" className="mt-2 inline-block text-wine hover:underline">{tt("Murojaatlar bo‘limi →")}</Link>
        </section>
      ) : null}

      <OrderPhotos photos={photos} action={adminOrderPhotoAction.bind(null, o.id)} canUpload={["confirmed", "preparing", "ready", "dispatched", "delivered"].includes(o.status)} />

      <section className="card p-5" aria-label={tt("To‘lov")}>
        <h2 className="mb-3 text-2xl">{tt("To‘lov")}</h2>
        {o.paymentMethod === "cash" ? (
          <form action={setPaymentStatusAction.bind(null, o.id)} className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="ps">{tt("Naqd to‘lov holati:")}</label>
            <select id="ps" name="paymentStatus" defaultValue={o.paymentStatus} className="field w-auto py-2">
              {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{tt(v)}</option>)}
            </select>
            <SubmitButton className="btn-secondary btn-sm">{tt("Saqlash")}</SubmitButton>
          </form>
        ) : (
          <p className="text-sm text-muted">{tt("Onlayn to‘lov holati faqat {p} serveridan kelgan tasdiq orqali o‘zgaradi.", { p: tt(PAYMENT_METHOD_LABEL[o.paymentMethod]) })}</p>
        )}
        {pays.length ? (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {pays.map((p) => <li key={p.id}>{tt("{provider} #{providerTransactionId} · holat {state} · {p} · {p2}", { provider: p.provider, providerTransactionId: p.providerTransactionId, state: p.state, p: tt.uzs(p.amount), p2: formatDateTime(p.createTime) })}</li>)}
          </ul>
        ) : null}
      </section>

      <section className="card p-5" aria-label={tt("Yetkazib berishni tahrirlash")}>
        <h2 className="mb-3 text-2xl">{tt("Yetkazib berish ma’lumotlarini o‘zgartirish")}</h2>
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
        <section className="card p-5 text-sm" aria-label={tt("Tarix")}>
          <h2 className="mb-3 text-2xl">{tt("Tarix")}</h2>
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id}>
                <span className="text-muted">{formatDateTime(e.createdAt)}</span> — {tt(e.message)} <span className="text-xs text-muted">({e.actor}{e.isPublic ? tt(", mijozga ko‘rinadi") : ""})</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5 text-sm" aria-label={tt("Bildirishnomalar")}>
          <h2 className="mb-3 text-2xl">{tt("Bildirishnomalar")}</h2>
          <p className="mb-3 text-xs text-muted">{tt("Buyurtma bazada saqlangan — xabar yuborilmasa ham u yo‘qolmaydi. Xatoni tuzatib, qayta yuboring.")}</p>
          {notes.length === 0 ? <p className="text-muted">{tt("Yozuv yo‘q.")}</p> : (
            <ul className="space-y-1">
              {notes.map((n) => (
                <li key={n.id}>
                  <span className="font-semibold">{n.channel === "email" ? tt("Email") : n.channel === "telegram-customer" ? tt("Mijozga (Telegram)") : tt("Telegram")}</span> · <span className={n.status === "sent" ? "text-success" : n.status === "failed" ? "text-danger" : "text-muted"}>{n.status === "sent" ? tt("Yuborildi") : n.status === "failed" ? tt("Xato") : tt("O‘tkazib yuborildi")}</span> · {formatDateTime(n.createdAt)} · {n.detail}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={resendTelegramAction.bind(null, o.id)}>
              <SubmitButton className="btn-secondary btn-sm" pendingLabel="Yuborilmoqda…">{tt("Telegram’ga qayta yuborish")}</SubmitButton>
            </form>
            <form action={resendEmailAction.bind(null, o.id)}>
              <SubmitButton className="btn-secondary btn-sm" pendingLabel="Yuborilmoqda…">{tt("Email’ga qayta yuborish")}</SubmitButton>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
