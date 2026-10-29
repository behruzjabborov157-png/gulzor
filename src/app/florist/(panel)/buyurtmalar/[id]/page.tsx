import Link from "next/link";
import { notFound } from "next/navigation";
import { floristCashPaidAction, floristDisputeNoteAction, floristOrderPhotoAction, floristOrderStatusAction } from "@/app/florist/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { OrderPhotos } from "@/components/admin/order-photos";
import { Alert } from "@/components/ui/primitives";
import { requireFlorist } from "@/lib/auth";
import { FLORIST_TRANSITIONS, floristOrder } from "@/lib/florist-panel";
import { formatDateISO, formatDateTime, formatPhone, formatUZS } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/orders";
import { mapLinks } from "@/lib/telegram";
import { DISPUTE_REASON_LABEL, DISPUTE_STATUS_LABEL, orderDisputes, orderPhotos } from "@/lib/trust";

export const metadata = { title: "Buyurtma" };

const ACTION_LABEL: Record<string, string> = {
  confirmed: "Qabul qilish",
  rejected: "Rad etish",
  preparing: "Tayyorlashni boshlash",
  ready: "Tayyor",
  dispatched: "Kuryerga berildi",
  delivered: "Yetkazildi / topshirildi",
};

export default async function FloristOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireFlorist();
  const { id } = await params;
  // Scoped lookup: another shop's order id simply does not exist here.
  const found = await floristOrder(me.floristId, id);
  if (!found) notFound();
  const { order: o, items, events } = found;
  const next = FLORIST_TRANSITIONS[o.status];
  const forward = next.filter((s) => s !== "rejected");
  const [photos, disputes] = await Promise.all([orderPhotos(o.id), orderDisputes(o.id)]);
  const photoAllowed = ["confirmed", "preparing", "ready", "dispatched", "delivered"].includes(o.status);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/florist/buyurtmalar" className="text-sm text-muted hover:text-wine">
          ← Buyurtmalar
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl">{o.number}</h1>
          <span className="badge bg-wine text-ivory">{ORDER_STATUS_LABEL[o.status]}</span>
          <span className="badge bg-petal text-charcoal">
            {PAYMENT_METHOD_LABEL[o.paymentMethod]} · {PAYMENT_STATUS_LABEL[o.paymentStatus]}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Yaratildi: {formatDateTime(o.createdAt)} · Mijoz tili: {o.locale === "ru" ? "rus tili" : "o‘zbek tili"}
        </p>
      </div>

      {o.status === "new" ? <Alert tone="warning">Yangi buyurtma: iloji boricha tez qabul qiling yoki sababini yozib rad eting.</Alert> : null}

      {next.length ? (
        <section className="card p-5" aria-label="Holatni o‘zgartirish">
          <h2 className="mb-3 font-sans text-sm font-semibold">Keyingi qadam</h2>
          <div className="flex flex-wrap gap-4">
            {forward.map((s) => (
              <AdminForm key={s} action={floristOrderStatusAction.bind(null, o.id, s)} submitLabel={ACTION_LABEL[s]}>
                <span className="sr-only">{ACTION_LABEL[s]}</span>
              </AdminForm>
            ))}
          </div>
          {next.includes("rejected") ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-danger">Rad etish…</summary>
              <AdminForm action={floristOrderStatusAction.bind(null, o.id, "rejected")} submitLabel="Rad etish" className="mt-3">
                <label htmlFor="reason" className="label">
                  Sabab (mijozga ko‘rinadi)
                </label>
                <input id="reason" name="reason" required minLength={3} maxLength={300} className="field max-w-md py-2 text-sm" />
              </AdminForm>
              <p className="mt-2 text-xs text-muted">Rad etilganda zahiradagi mahsulotlar qaytariladi va mijoz xabardor qilinadi.</p>
            </details>
          ) : null}
          <p className="mt-4 text-xs text-muted">Qabul qilingan buyurtmani bekor qilish kerak bo‘lsa, Gulzor bilan bog‘laning.</p>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 text-sm" aria-label="Mijoz">
          <h2 className="mb-3 text-2xl">Mijoz</h2>
          <p>
            <strong>{o.customerName}</strong> ·{" "}
            <a href={`tel:${o.customerPhone}`} className="text-wine">
              {formatPhone(o.customerPhone)}
            </a>
          </p>
          <p className="mt-2 text-muted">Qabul qiluvchi</p>
          <p>
            <strong>{o.recipientName}</strong> ·{" "}
            <a href={`tel:${o.recipientPhone}`} className="text-wine">
              {formatPhone(o.recipientPhone)}
            </a>
            {o.anonymous ? " · anonim (kimdanligini aytmang)" : ""}
          </p>
          <p className="mt-2 text-muted">{o.fulfillment === "pickup" ? "Olib ketish" : "Manzil"}</p>
          <p>
            {[o.regionName, o.zoneName, o.district, o.neighborhood, o.address, o.apartment && `kv. ${o.apartment}`, o.landmark && `mo‘ljal: ${o.landmark}`]
              .filter(Boolean)
              .join(", ")}
          </p>
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
          <p>
            {formatDateISO(o.deliveryDate)}, {o.slotLabel}
          </p>
          {o.cardMessage ? (
            <>
              <p className="mt-2 text-muted">Otkritka</p>
              <p className="italic">“{o.cardMessage}”</p>
            </>
          ) : null}
          {o.courierNote ? (
            <>
              <p className="mt-2 text-muted">Kuryer uchun</p>
              <p>{o.courierNote}</p>
            </>
          ) : null}
        </section>

        <section className="card p-5 text-sm" aria-label="Tarkib">
          <h2 className="mb-3 text-2xl">Tarkib</h2>
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 py-2">
                <div>
                  <p>
                    {i.productName} × {i.quantity}
                  </p>
                  <p className="text-xs text-muted">{[i.variantName, i.stems ? `${i.stems} dona` : null, i.color].filter(Boolean).join(" · ")}</p>
                  {i.addons.map((a) => (
                    <p key={a.productId} className="text-xs text-muted">
                      + {a.name} × {a.quantity} ({formatUZS(a.unitPrice)})
                    </p>
                  ))}
                </div>
                <p className="shrink-0">{formatUZS(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-line pt-3">
            <div className="flex justify-between">
              <dt>Mahsulotlar</dt>
              <dd>{formatUZS(o.subtotal)}</dd>
            </div>
            {o.discount ? (
              <div className="flex justify-between">
                <dt>Chegirma {o.couponCode}</dt>
                <dd>−{formatUZS(o.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>Yetkazish</dt>
              <dd>{formatUZS(o.deliveryFee)}</dd>
            </div>
            {o.serviceFee ? (
              <div className="flex justify-between">
                <dt>Xizmat haqi</dt>
                <dd>{formatUZS(o.serviceFee)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-base font-semibold">
              <dt>Mijoz to‘laydi</dt>
              <dd>{formatUZS(o.total)}</dd>
            </div>
            <div className="flex justify-between text-xs text-muted">
              <dt>Gulzor komissiyasi ({(o.commissionRate / 100).toLocaleString("uz-UZ")}%)</dt>
              <dd>{formatUZS(o.commissionAmount)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {disputes.length ? (
        <section className="card border-danger/30 p-5 text-sm" aria-labelledby="disputes-h">
          <h2 id="disputes-h" className="mb-3 text-2xl">
            Mijoz murojaatlari
          </h2>
          <ul className="space-y-4">
            {disputes.map((d) => (
              <li key={d.id} className="rounded-xl border border-line p-4">
                <p className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{DISPUTE_REASON_LABEL[d.reason]}</span>
                  <span className="text-muted">
                    {formatDateTime(d.createdAt)} · {DISPUTE_STATUS_LABEL[d.status]}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-line">{d.message}</p>
                {d.resolution ? <p className="mt-2 text-wine">Gulzor qarori: {d.resolution}</p> : null}
                {d.status === "open" ? (
                  <AdminForm action={floristDisputeNoteAction.bind(null, d.id, o.id)} submitLabel="Izohni yuborish" className="mt-3">
                    <label htmlFor={`note-${d.id}`} className="label">
                      Sizning izohingiz (Gulzor ko‘radi)
                    </label>
                    <textarea id={`note-${d.id}`} name="note" defaultValue={d.floristNote ?? ""} rows={3} maxLength={2000} required className="field" />
                  </AdminForm>
                ) : d.floristNote ? (
                  <p className="mt-2 text-muted">Sizning izohingiz: {d.floristNote}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <OrderPhotos photos={photos} action={floristOrderPhotoAction.bind(null, o.id)} canUpload={photoAllowed} />

      <section className="card p-5 text-sm" aria-label="To‘lov">
        <h2 className="mb-3 text-2xl">To‘lov</h2>
        {o.paymentMethod === "cash" ? (
          o.paymentStatus === "paid" ? (
            <p className="text-success">Naqd to‘lov qabul qilingan.</p>
          ) : (
            <AdminForm action={floristCashPaidAction.bind(null, o.id)} submitLabel="Naqd pul qabul qilindi">
              <p className="text-muted">Mijoz naqd to‘lovni sizga beradi. Pulni olgach, shu tugmani bosing.</p>
            </AdminForm>
          )
        ) : (
          <p className="text-muted">Onlayn to‘lov holati faqat {PAYMENT_METHOD_LABEL[o.paymentMethod]} tizimidan kelgan tasdiq orqali o‘zgaradi.</p>
        )}
      </section>

      <section className="card p-5 text-sm" aria-label="Tarix">
        <h2 className="mb-3 text-2xl">Tarix</h2>
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id}>
              <span className="text-muted">{formatDateTime(e.createdAt)}</span> — {e.message}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
