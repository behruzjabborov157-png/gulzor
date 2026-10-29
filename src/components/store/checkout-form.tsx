"use client";

import { PhoneInput } from "@/components/ui/phone-input";
import Link from "next/link";
import { useState } from "react";
import { checkoutAction } from "@/app/actions";
import { Alert, EmptyState, ProductImage } from "@/components/ui/primitives";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { formatDateISO, formatUZS } from "@/lib/format";
import { cartStore, clearCart, toServerLines } from "./cart";
import { Summary } from "./cart-view";
import { prefsStore, useQuote } from "./use-quote";

type Region = { id: number; name: string; zones: { id: number; name: string; description: string; fee: number }[] };
type SavedAddress = {
  id: number;
  label: string;
  recipientName: string;
  recipientPhone: string;
  zoneId: number | null;
  district: string;
  neighborhood: string;
  address: string;
  apartment: string;
  landmark: string;
};

export type CheckoutProps = {
  regions: Region[];
  pickup: { enabled: boolean; address: string };
  payments: { id: "cash" | "payme" | "click"; label: string; hint: string }[];
  dates: { min: string; max: string; today: string; tomorrow: string };
  customer: { name: string; phone: string } | null;
  addresses: SavedAddress[];
  contactHref: string | null;
};

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-7" aria-labelledby={`s${n}`}>
      <h2 id={`s${n}`} className="mb-5 flex items-center gap-3 text-2xl">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-wine font-sans text-sm text-ivory">{n}</span>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function CheckoutForm(props: CheckoutProps) {
  const [lines, , hydrated] = cartStore.useStore();
  const [prefs, setPrefs, prefsReady] = prefsStore.useStore();
  const { locale, t: dict, href } = useT();
  const t = dict.checkout;
  const uzs = (n: number) => formatUZS(n, locale);

  const [f, setF] = useState({
    customerName: props.customer?.name ?? "",
    customerPhone: props.customer?.phone ?? "",
    recipientIsCustomer: false,
    recipientName: "",
    recipientPhone: "",
    anonymous: false,
    fulfillment: "delivery" as "delivery" | "pickup",
    regionId: null as number | null,
    district: "",
    neighborhood: "",
    address: "",
    apartment: "",
    landmark: "",
    date: props.dates.today,
    slotId: null as number | null,
    courierNote: "",
    cardMessage: "",
    paymentMethod: props.payments[0]?.id ?? "cash",
    saveAddress: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  // Region and zone are derived: an explicit choice wins, then the zone remembered from the cart, then the first one.
  const regionId = f.regionId ?? props.regions.find((r) => r.zones.some((z) => z.id === prefs.zoneId))?.id ?? props.regions[0]?.id ?? null;
  const region = props.regions.find((r) => r.id === regionId) ?? null;
  const zoneId = region?.zones.some((z) => z.id === prefs.zoneId) ? prefs.zoneId : (region?.zones[0]?.id ?? null);

  // useQuote re-requests only when the serialized input changes, so no memoization is needed here.
  const quoteInput =
    hydrated && prefsReady && lines.length
      ? {
          lines: toServerLines(lines),
          couponCode: prefs.couponCode || null,
          fulfillment: f.fulfillment,
          zoneId: f.fulfillment === "delivery" ? zoneId : null,
          date: f.date,
        }
      : null;
  const { quote, error: quoteError, loading } = useQuote(quoteInput);

  // A chosen slot only counts while the latest quote says it is still available.
  const slotId = f.slotId != null && quote?.slots.find((x) => x.id === f.slotId)?.available ? f.slotId : null;

  const [submitting, setSubmitting] = useState(false);
  // One id per checkout visit: the server turns repeated submits (double tap, retry) into the same order.
  const [submissionId] = useState(newSubmissionId);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState(false);

  if (!hydrated) return <div className="h-96 animate-pulse rounded-2xl bg-cream" />;
  if (lines.length === 0) {
    return (
      <EmptyState
        title={t.emptyTitle}
        text={t.emptyText}
        action={
          <Link href={href("/katalog")} className="btn-primary">
            {t.toCatalog}
          </Link>
        }
      />
    );
  }

  const fe = (k: string) => fieldErrors[k];
  const inputProps = (k: string) => ({ id: k, "aria-invalid": !!fe(k), "aria-describedby": fe(k) ? `${k}-err` : undefined });

  async function submit() {
    setSubmitting(true);
    setErrors([]);
    setFieldErrors({});
    try {
      const res = await checkoutAction({
        submissionId,
        lines: toServerLines(lines),
        couponCode: prefs.couponCode || null,
        fulfillment: f.fulfillment,
        customerName: f.customerName,
        customerPhone: f.customerPhone,
        recipientIsCustomer: f.recipientIsCustomer,
        recipientName: f.recipientName,
        recipientPhone: f.recipientPhone,
        anonymous: f.anonymous,
        zoneId: f.fulfillment === "delivery" ? zoneId : null,
        district: f.district,
        neighborhood: f.neighborhood,
        address: f.address,
        apartment: f.apartment,
        landmark: f.landmark,
        date: f.date,
        slotId: slotId ?? 0,
        courierNote: f.courierNote,
        cardMessage: f.cardMessage,
        paymentMethod: f.paymentMethod,
        saveAddress: f.saveAddress,
      });
      if (res.ok) {
        clearCart();
        setPrefs((p) => ({ ...p, couponCode: "" }));
        window.location.assign(res.redirectTo);
        return;
      }
      setErrors(res.errors);
      setFieldErrors(res.fieldErrors ?? {});
      setReviewed(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrors([t.offline]);
    } finally {
      setSubmitting(false);
    }
  }

  const slots = quote?.slots ?? [];
  const canReview = !!quote && quote.errors.length === 0 && slotId != null && !loading;

  return (
    <form
      className="grid gap-8 lg:grid-cols-[1fr_400px]"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!reviewed) {
          setReviewed(true);
          document.getElementById("review")?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        submit();
      }}
    >
      <div className="space-y-6">
        {errors.length ? (
          <Alert tone="error">
            <ul className="list-inside list-disc space-y-1">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <Section n={1} title={t.buyer}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="customerName" label={t.yourName} error={fe("customerName")}>
              <input {...inputProps("customerName")} className="field" autoComplete="name" value={f.customerName} onChange={(e) => set("customerName", e.target.value)} maxLength={80} required />
            </Field>
            <Field id="customerPhone" label={t.yourPhone} error={fe("customerPhone")} hint={t.yourPhoneHint}>
              <PhoneInput {...inputProps("customerPhone")} value={f.customerPhone} onValueChange={(v) => set("customerPhone", v)} required />
            </Field>
          </div>
        </Section>

        <Section n={2} title={t.recipient}>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={f.recipientIsCustomer} onChange={(e) => set("recipientIsCustomer", e.target.checked)} className="h-4 w-4 accent-wine" />
            {t.selfReceive}
          </label>
          {!f.recipientIsCustomer ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="recipientName" label={t.recipientName} error={fe("recipientName")}>
                  <input {...inputProps("recipientName")} className="field" value={f.recipientName} onChange={(e) => set("recipientName", e.target.value)} maxLength={80} />
                </Field>
                <Field id="recipientPhone" label={t.recipientPhone} error={fe("recipientPhone")} hint={t.recipientPhoneHint}>
                  <PhoneInput {...inputProps("recipientPhone")} autoComplete="off" value={f.recipientPhone} onValueChange={(v) => set("recipientPhone", v)} />
                </Field>
              </div>
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" checked={f.anonymous} onChange={(e) => set("anonymous", e.target.checked)} className="h-4 w-4 accent-wine" />
                {t.anonymous}
              </label>
            </>
          ) : null}
        </Section>

        <Section n={3} title={t.delivery}>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">{t.method}</legend>
            {[
              { v: "delivery" as const, title: t.toAddress, d: t.toAddressHint },
              ...(props.pickup.enabled ? [{ v: "pickup" as const, title: t.pickup, d: props.pickup.address || t.pickupFallback }] : []),
            ].map((o) => (
              <label key={o.v} className={`cursor-pointer rounded-xl border p-4 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-wine ${f.fulfillment === o.v ? "border-wine bg-wine/5" : "border-line bg-white"}`}>
                <input type="radio" name="fulfillment" className="sr-only" checked={f.fulfillment === o.v} onChange={() => set("fulfillment", o.v)} />
                <span className="block font-semibold">{o.title}</span>
                <span className="block text-sm text-muted">{o.d}</span>
              </label>
            ))}
          </fieldset>

          {f.fulfillment === "delivery" ? (
            props.regions.length === 0 ? (
              <Alert tone="warning">
                {t.noZones}{" "}
                {props.contactHref ? (
                  <a href={props.contactHref} className="underline">
                    {t.contactUs}
                  </a>
                ) : (
                  t.contactShop
                )}
              </Alert>
            ) : (
              <>
                {props.addresses.length ? (
                  <Field id="saved" label={t.saved}>
                    <select
                      id="saved"
                      className="field"
                      defaultValue=""
                      onChange={(e) => {
                        const a = props.addresses.find((x) => x.id === Number(e.target.value));
                        if (!a) return;
                        setF((p) => ({
                          ...p,
                          recipientIsCustomer: false,
                          recipientName: a.recipientName,
                          recipientPhone: a.recipientPhone,
                          district: a.district,
                          neighborhood: a.neighborhood,
                          address: a.address,
                          apartment: a.apartment,
                          landmark: a.landmark,
                          regionId: props.regions.find((r) => r.zones.some((z) => z.id === a.zoneId))?.id ?? p.regionId,
                        }));
                        if (a.zoneId) setPrefs((p) => ({ ...p, zoneId: a.zoneId }));
                      }}
                    >
                      <option value="">{t.select}</option>
                      {props.addresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label} — {a.recipientName}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="region" label={t.region}>
                    <select id="region" className="field" value={regionId ?? ""}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        set("regionId", id);
                        setPrefs((p) => ({ ...p, zoneId: props.regions.find((r) => r.id === id)?.zones[0]?.id ?? null }));
                      }}
                    >
                      {props.regions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="zoneId" label={t.zone} error={fe("zoneId")}>
                    <select {...inputProps("zoneId")} className="field" value={zoneId ?? ""} onChange={(e) => setPrefs((p) => ({ ...p, zoneId: Number(e.target.value) || null }))}>
                      {region?.zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} — {uzs(z.fee)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {region?.zones.find((z) => z.id === zoneId)?.description ? (
                  <p className="-mt-2 text-xs text-muted">{fmt(t.includes, { list: region.zones.find((z) => z.id === zoneId)!.description })}</p>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="district" label={t.district} error={fe("district")}>
                    <input {...inputProps("district")} className="field" value={f.district} onChange={(e) => set("district", e.target.value)} maxLength={80} />
                  </Field>
                  <Field id="neighborhood" label={t.neighborhood} error={fe("neighborhood")}>
                    <input {...inputProps("neighborhood")} className="field" value={f.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} maxLength={80} />
                  </Field>
                </div>
                <Field id="address" label={t.address} error={fe("address")}>
                  <input {...inputProps("address")} className="field" autoComplete="street-address" value={f.address} onChange={(e) => set("address", e.target.value)} maxLength={200} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="apartment" label={t.apartment} error={fe("apartment")}>
                    <input {...inputProps("apartment")} className="field" value={f.apartment} onChange={(e) => set("apartment", e.target.value)} maxLength={40} />
                  </Field>
                  <Field id="landmark" label={t.landmark} error={fe("landmark")}>
                    <input {...inputProps("landmark")} className="field" value={f.landmark} onChange={(e) => set("landmark", e.target.value)} maxLength={160} />
                  </Field>
                </div>
                {props.customer ? (
                  <label className="flex items-center gap-2.5 text-sm">
                    <input type="checkbox" checked={f.saveAddress} onChange={(e) => set("saveAddress", e.target.checked)} className="h-4 w-4 accent-wine" />
                    {t.saveAddress}
                  </label>
                ) : null}
                <p className="text-xs text-muted">
                  {t.zoneMissing}{" "}
                  {props.contactHref ? (
                    <a href={props.contactHref} target="_blank" rel="noopener noreferrer" className="underline">
                      {t.contactUs}
                    </a>
                  ) : (
                    <Link href={href("/yetkazib-berish")} className="underline">
                      {t.seeDelivery}
                    </Link>
                  )}{" "}
                  {t.zoneMissingEnd}
                </p>
              </>
            )
          ) : null}
        </Section>

        <Section n={4} title={t.dateTime}>
          <div className="flex flex-wrap items-end gap-3">
            <Field id="date" label={t.date} error={fe("date")}>
              <input
                {...inputProps("date")}
                type="date"
                className="field w-auto"
                min={props.dates.min}
                max={props.dates.max}
                value={f.date}
                onChange={(e) => setF((p) => ({ ...p, date: e.target.value, slotId: null }))}
              />
            </Field>
            {[
              { d: props.dates.today, label: t.today },
              { d: props.dates.tomorrow, label: t.tomorrow },
            ].map((o) => (
              <button key={o.d} type="button" onClick={() => setF((p) => ({ ...p, date: o.d, slotId: null }))} className={`chip mb-1 ${f.date === o.d ? "chip-active" : ""}`}>
                {o.label}
              </button>
            ))}
          </div>
          {f.date ? <p className="text-sm text-muted">{formatDateISO(f.date, true, locale)}</p> : null}
          <fieldset>
            <legend className="label">{t.slot}</legend>
            {f.fulfillment === "delivery" && !zoneId ? (
              <p className="text-sm text-muted">{t.pickZoneFirst}</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted">{loading ? dict.common.loading : t.noSlots}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {slots.map((s) => (
                  <label
                    key={s.id}
                    className={`rounded-xl border px-3 py-3 text-center text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-wine ${
                      !s.available ? "cursor-not-allowed border-line bg-cream text-muted" : slotId === s.id ? "cursor-pointer border-wine bg-wine text-ivory" : "cursor-pointer border-line bg-white hover:border-wine/40"
                    }`}
                  >
                    <input type="radio" name="slot" className="sr-only" disabled={!s.available} checked={slotId === s.id} onChange={() => set("slotId", s.id)} />
                    <span className="block font-semibold">{s.label}</span>
                    {!s.available && s.reason ? <span className="block text-[11px]">{t.slotReason[s.reason]}</span> : null}
                  </label>
                ))}
              </div>
            )}
            {fe("slotId") ? <p className="mt-1 text-sm text-danger">{fe("slotId")}</p> : null}
            {quote && quote.prepMinutes >= 1440 ? (
              <p className="mt-2 text-xs text-muted">{t.prepNote}</p>
            ) : null}
          </fieldset>
        </Section>

        <Section n={5} title={t.cardAndNote}>
          <Field id="cardMessage" label={t.card} error={fe("cardMessage")} hint={fmt(t.cardHint, { n: f.cardMessage.length })}>
            <textarea {...inputProps("cardMessage")} className="field min-h-24" maxLength={300} value={f.cardMessage} onChange={(e) => set("cardMessage", e.target.value)} placeholder={t.cardPlaceholder} />
          </Field>
          {f.fulfillment === "delivery" ? (
            <Field id="courierNote" label={t.courier} error={fe("courierNote")}>
              <textarea {...inputProps("courierNote")} className="field min-h-20" maxLength={500} value={f.courierNote} onChange={(e) => set("courierNote", e.target.value)} placeholder={t.courierPlaceholder} />
            </Field>
          ) : null}
        </Section>

        <Section n={6} title={t.payment}>
          {props.payments.length === 0 ? (
            <Alert tone="warning">{t.noPayments}</Alert>
          ) : (
            <fieldset className="grid gap-2">
              <legend className="sr-only">{t.payment}</legend>
              {props.payments.map((p) => (
                <label key={p.id} className={`cursor-pointer rounded-xl border p-4 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-wine ${f.paymentMethod === p.id ? "border-wine bg-wine/5" : "border-line bg-white"}`}>
                  <input type="radio" name="payment" className="sr-only" checked={f.paymentMethod === p.id} onChange={() => set("paymentMethod", p.id)} />
                  <span className="block font-semibold">{p.label}</span>
                  <span className="block text-sm text-muted">{p.hint}</span>
                </label>
              ))}
            </fieldset>
          )}
          {fe("paymentMethod") ? <p className="text-sm text-danger">{fe("paymentMethod")}</p> : null}
        </Section>
      </div>

      <aside className="lg:sticky lg:top-36 lg:self-start" id="review">
        <div className="card space-y-5 p-6">
          <h2 className="text-2xl">{t.summary}</h2>
          <ul className="space-y-4">
            {(quote?.lines ?? []).map((l) => (
              <li key={l.index} className="flex gap-3">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-cream">
                  <ProductImage src={l.image} alt={l.name} sizes="56px" locale={locale} />
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    {l.name} <span className="text-muted">× {l.quantity}</span>
                  </p>
                  <p className="text-muted">
                    {[l.variantName, l.stems ? fmt(dict.common.pieces, { n: l.stems }) : null, l.colorLabel, ...l.addons.map((a) => `+ ${a.name}`)].filter(Boolean).join(" · ")}
                  </p>
                  {l.error ? <p className="text-danger">{l.error}</p> : null}
                </div>
                <p className="shrink-0 text-sm font-semibold">{l.error ? "—" : uzs(l.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <Summary quote={quote} loading={loading} />
          {quoteError ? <Alert tone="error">{quoteError}</Alert> : null}
          {quote?.errors.length ? (
            <Alert tone="error">
              <ul className="list-inside list-disc space-y-1">
                {quote.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
              </ul>
            </Alert>
          ) : null}

          {reviewed && quote ? (
            <div className="space-y-1.5 rounded-xl bg-cream p-4 text-sm">
              <p className="font-semibold">{t.check}</p>
              <p>
                {f.fulfillment === "pickup"
                  ? fmt(t.pickupAt, { address: props.pickup.address })
                  : `${quote.zone?.regionName ?? ""}, ${quote.zone?.name ?? ""}, ${[f.district, f.neighborhood, f.address, f.apartment].filter(Boolean).join(", ")}`}
              </p>
              <p>
                {formatDateISO(f.date, true, locale)}, {slots.find((s) => s.id === slotId)?.label}
              </p>
              <p>{fmt(t.recipientIs, { name: f.recipientIsCustomer ? f.customerName : f.recipientName })}</p>
              <p>{fmt(t.paymentIs, { method: props.payments.find((p) => p.id === f.paymentMethod)?.label ?? "" })}</p>
            </div>
          ) : null}

          <button type="submit" className="btn-primary w-full py-4 text-base" disabled={submitting || !canReview || props.payments.length === 0}>
            {submitting ? t.sending : reviewed ? fmt(t.confirm, { total: quote ? uzs(quote.total) : "" }) : t.continue}
          </button>
          {!canReview && !loading ? <p className="text-center text-xs text-muted">{t.fillAll}</p> : null}
          <p className="text-center text-xs leading-relaxed text-muted">
            {t.termsBefore}
            <Link href={href("/oferta")} className="underline">
              {t.terms}
            </Link>
            {t.termsAnd}
            <Link href={href("/maxfiylik")} className="underline">
              {t.privacy}
            </Link>
            {t.termsAfter}
          </p>
        </div>
      </aside>
    </form>
  );
}

/** RFC 4122 v4 id. randomUUID() needs a secure context (HTTPS/localhost), so fall back to getRandomValues. */
function newSubmissionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
