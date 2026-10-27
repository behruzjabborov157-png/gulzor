import { saveSettingsAction } from "@/app/admin/actions";
import { AdminForm, C, F } from "@/components/admin/admin-form";
import { TelegramTest } from "@/components/admin/telegram-test";
import { requireOwner } from "@/lib/auth";
import { clickCredentials, paymeCredentials } from "@/lib/payments/config";
import { getSettings, siteUrl } from "@/lib/settings";
import { telegramConfigured } from "@/lib/telegram";

export const metadata = { title: "Sozlamalar" };

function Status({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return <span className={`badge ${ok ? "bg-sage-light text-forest" : "bg-blush text-charcoal"}`}>{ok ? yes : no}</span>;
}

export default async function SettingsAdmin() {
  await requireOwner();
  const { store, checkout } = await getSettings();
  const base = siteUrl();

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-4xl">Sozlamalar</h1>

      <AdminForm action={saveSettingsAction} className="space-y-6">
        <section className="card space-y-3 p-6">
          <h2 className="text-2xl">Do‘kon va aloqa</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Do‘kon nomi" name="name" defaultValue={store.name} />
            <F label="Yuridik nomi (oferta va footer uchun)" name="legalName" defaultValue={store.legalName} placeholder="masalan, “Gulzor” MChJ" />
            <F label="Telefon" name="phone" defaultValue={store.phone} placeholder="+998 90 123 45 67" />
            <F label="Telegram username (mijozlar yozishi uchun)" name="telegramUsername" defaultValue={store.telegramUsername} placeholder="gulzor_uz" />
            <F label="Email" name="email" type="email" defaultValue={store.email} />
            <F label="Instagram havolasi" name="instagramUrl" defaultValue={store.instagramUrl} placeholder="https://instagram.com/..." />
            <F label="Manzil" name="address" defaultValue={store.address} />
            <F label="Ish vaqti" name="workingHours" defaultValue={store.workingHours} placeholder="Har kuni 08:00–22:00" />
            <input type="hidden" name="tagline" value={store.tagline} />
          </div>
        </section>

        <section className="card space-y-3 p-6">
          <h2 className="text-2xl">Buyurtma va to‘lov</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Xizmat haqi, so‘m (0 = yo‘q)" name="serviceFee" defaultValue={checkout.serviceFee} inputMode="numeric" />
            <F label="Xizmat haqi nomi" name="serviceFeeLabel" defaultValue={checkout.serviceFeeLabel} />
            <F label="Necha kun oldinga buyurtma (maks.)" name="maxDaysAhead" defaultValue={checkout.maxDaysAhead} inputMode="numeric" />
            <F label="Olib ketish manzili" name="pickupAddress" defaultValue={checkout.pickupAddress} />
            <F label="Olib ketish uchun tayyorlash (daqiqa)" name="pickupPrepMinutes" defaultValue={checkout.pickupPrepMinutes} inputMode="numeric" />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
            <C label="Olib ketish mavjud" name="pickupEnabled" defaultChecked={checkout.pickupEnabled} />
            <C label="Naqd to‘lov (qabul qilganda)" name="cashEnabled" defaultChecked={checkout.cashEnabled} />
            <C label="Promokodlar" name="couponsEnabled" defaultChecked={checkout.couponsEnabled} />
            <C label="Payme’ni yoqish" name="paymeEnabled" defaultChecked={checkout.paymeEnabled} />
            <C label="Click’ni yoqish" name="clickEnabled" defaultChecked={checkout.clickEnabled} />
            <C label="Demo rejim banneri" name="demoMode" defaultChecked={checkout.demoMode} />
          </div>
          <p className="text-xs text-muted">Payme/Click faqat serverda merchant ma’lumotlari (.env) mavjud bo‘lsa mijozlarga ko‘rinadi.</p>
        </section>
      </AdminForm>

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">Integratsiyalar holati</h2>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <strong className="w-24">Telegram</strong>
            <Status ok={telegramConfigured()} yes="Sozlangan" no="Sozlanmagan" />
            <TelegramTest />
          </div>
          {!telegramConfigured() ? (
            <ol className="ml-6 list-decimal space-y-1 text-muted">
              <li>Telegram’da @BotFather → /newbot orqali bot yarating va tokenni oling.</li>
              <li>Botga yoki bot qo‘shilgan guruhga xabar yozing, so‘ng <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> dan <code>chat.id</code> ni oling.</li>
              <li>Serverdagi <code>.env.local</code> faylga <code>TELEGRAM_BOT_TOKEN</code> va <code>TELEGRAM_CHAT_ID</code> ni yozing va ilovani qayta ishga tushiring.</li>
              <li>Shu sahifada “Test xabar” tugmasini bosing.</li>
            </ol>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <strong className="w-24">Payme</strong>
            <Status ok={!!paymeCredentials()} yes="Kalitlar bor" no="Kalitlar yo‘q" />
            <span className="text-muted">Merchant API URL: <code>{base}/api/payments/payme</code></span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <strong className="w-24">Click</strong>
            <Status ok={!!clickCredentials()} yes="Kalitlar bor" no="Kalitlar yo‘q" />
            <span className="text-muted">Prepare: <code>{base}/api/payments/click/prepare</code> · Complete: <code>{base}/api/payments/click/complete</code></span>
          </div>
          <p className="text-xs text-muted">Onlayn to‘lovni yoqishdan oldin provayderning test muhitida to‘liq sinovdan o‘tkazing (README → “To‘lov integratsiyasi”).</p>
        </div>
      </section>
    </div>
  );
}
