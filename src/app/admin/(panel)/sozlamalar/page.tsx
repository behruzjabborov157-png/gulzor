import { panelT } from "@/i18n/panel/server";
import { PROVIDERS } from "@/lib/payments/providers";
import { saveSettingsAction } from "@/app/admin/actions";
import { AdminForm, C, F } from "@/components/admin/admin-form";
import { EmailTest } from "@/components/admin/email-test";
import { TelegramTest } from "@/components/admin/telegram-test";
import { requireOwner } from "@/lib/auth";
import { clickCredentials, paymeCredentials } from "@/lib/payments/config";
import { getSettings, siteUrl } from "@/lib/settings";
import { emailConfigured } from "@/lib/email";
import { telegramConfigured } from "@/lib/telegram";

export async function generateMetadata() {
  return { title: (await panelT())("Sozlamalar") };
}

function Status({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return <span className={`badge ${ok ? "bg-sage-light text-wine" : "bg-petal text-charcoal"}`}>{ok ? yes : no}</span>;
}

export default async function SettingsAdmin() {
  const tt = await panelT();
  await requireOwner();
  const { store, checkout } = await getSettings();
  const base = siteUrl();

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-4xl">{tt("Sozlamalar")}</h1>

      <AdminForm action={saveSettingsAction} className="space-y-6">
        <section className="card space-y-3 p-6">
          <h2 className="text-2xl">{tt("Do‘kon va aloqa")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label={tt("Do‘kon nomi")} name="name" defaultValue={store.name} />
            <F label={tt("Yuridik nomi (oferta va footer uchun)")} name="legalName" defaultValue={store.legalName} placeholder={tt("masalan, “Gulzor” MChJ")} />
            <F label={tt("Telefon")} name="phone" defaultValue={store.phone} placeholder="+998 90 123 45 67" />
            <F label={tt("Telegram username (mijozlar yozishi uchun)")} name="telegramUsername" defaultValue={store.telegramUsername} placeholder={tt("gulzor_uz")} />
            <F label={tt("Email")} name="email" type="email" defaultValue={store.email} />
            <F label={tt("Instagram havolasi")} name="instagramUrl" defaultValue={store.instagramUrl} placeholder={tt("https://instagram.com/...")} />
            <F label={tt("Manzil")} name="address" defaultValue={store.address} />
            <F label={tt("Manzil (rus.)")} name="addressRu" defaultValue={store.addressRu} lang="ru" />
            <F label={tt("Manzil (ingl.)")} name="addressEn" defaultValue={store.addressEn} lang="en" />
            <F label={tt("Ish vaqti")} name="workingHours" defaultValue={store.workingHours} placeholder={tt("Har kuni 08:00–22:00")} />
            <F label={tt("Ish vaqti (rus.)")} name="workingHoursRu" defaultValue={store.workingHoursRu} placeholder={tt("Ежедневно 08:00–22:00")} lang="ru" />
            <F label={tt("Ish vaqti (ingl.)")} name="workingHoursEn" defaultValue={store.workingHoursEn} placeholder={tt("Daily 08:00–22:00")} lang="en" />
            <input type="hidden" name="tagline" value={store.tagline} />
          </div>
        </section>

        <section className="card space-y-3 p-6">
          <h2 className="text-2xl">{tt("Buyurtma va to‘lov")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <F label={tt("Xizmat haqi, so‘m (0 = yo‘q)")} name="serviceFee" defaultValue={checkout.serviceFee} inputMode="numeric" />
            <F label={tt("Xizmat haqi nomi")} name="serviceFeeLabel" defaultValue={checkout.serviceFeeLabel} />
            <F label={tt("Xizmat haqi nomi (rus.)")} name="serviceFeeLabelRu" defaultValue={checkout.serviceFeeLabelRu} lang="ru" />
            <F label={tt("Xizmat haqi nomi (ingl.)")} name="serviceFeeLabelEn" defaultValue={checkout.serviceFeeLabelEn} lang="en" />
            <F label={tt("Necha kun oldinga buyurtma (maks.)")} name="maxDaysAhead" defaultValue={checkout.maxDaysAhead} inputMode="numeric" />
            <F label={tt("Olib ketish manzili")} name="pickupAddress" defaultValue={checkout.pickupAddress} />
            <F label={tt("Olib ketish manzili (rus.)")} name="pickupAddressRu" defaultValue={checkout.pickupAddressRu} lang="ru" />
            <F label={tt("Olib ketish manzili (ingl.)")} name="pickupAddressEn" defaultValue={checkout.pickupAddressEn} lang="en" />
            <F label={tt("Olib ketish uchun tayyorlash (daqiqa)")} name="pickupPrepMinutes" defaultValue={checkout.pickupPrepMinutes} inputMode="numeric" />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
            <C label={tt("Olib ketish mavjud")} name="pickupEnabled" defaultChecked={checkout.pickupEnabled} />
            <C label={tt("Naqd to‘lov (qabul qilganda)")} name="cashEnabled" defaultChecked={checkout.cashEnabled} />
            <C label={tt("Promokodlar")} name="couponsEnabled" defaultChecked={checkout.couponsEnabled} />
            <C label={tt("Payme’ni yoqish")} name="paymeEnabled" defaultChecked={checkout.paymeEnabled} />
            <C label={tt("Click’ni yoqish")} name="clickEnabled" defaultChecked={checkout.clickEnabled} />
            <C label={tt("Demo rejim banneri")} name="demoMode" defaultChecked={checkout.demoMode} />
          </div>
          <p className="text-xs text-muted">{tt("Payme/Click faqat serverda merchant ma’lumotlari (.env) mavjud bo‘lsa mijozlarga ko‘rinadi.")}</p>
        </section>
      </AdminForm>

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">{tt("Integratsiyalar holati")}</h2>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <strong className="w-24">{tt("Telegram")}</strong>
            <Status ok={telegramConfigured()} yes={tt("Sozlangan")} no={tt("Sozlanmagan")} />
            <TelegramTest />
          </div>
          {!telegramConfigured() ? (
            <ol className="ml-6 list-decimal space-y-1 text-muted">
              <li>{tt("Telegram’da @BotFather → /newbot orqali bot yarating va tokenni oling.")}</li>
              <li>{tt("Botga yoki bot qo‘shilgan guruhga xabar yozing, so‘ng")}{" "}<code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code>{" "}{tt("dan")}{" "}<code>{tt("chat.id")}</code>{" "}{tt("ni oling.")}</li>
              <li>{tt("Serverdagi")}{" "}<code>{tt(".env.local")}</code>{" "}{tt("faylga")}{" "}<code>{tt("TELEGRAM_BOT_TOKEN")}</code>{" "}{tt("va")}{" "}<code>{tt("TELEGRAM_CHAT_ID")}</code>{" "}{tt("ni yozing va ilovani qayta ishga tushiring.")}</li>
              <li>{tt("Shu sahifada “Test xabar” tugmasini bosing.")}</li>
            </ol>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <strong className="w-24">{tt("Email")}</strong>
            <Status ok={emailConfigured()} yes={tt("Sozlangan")} no={tt("Sozlanmagan (ixtiyoriy)")} />
            <EmailTest />
          </div>
          {!emailConfigured() ? (
            <p className="ml-6 text-muted">
              {tt("Ixtiyoriy ikkinchi kanal. Serverdagi")}{" "}<code>{tt(".env.local")}</code>{" "}{tt("ga")}{" "}<code>{tt("SMTP_HOST")}</code>, <code>{tt("SMTP_PORT")}</code>, <code>{tt("SMTP_USER")}</code>,{" "}
              <code>{tt("SMTP_PASS")}</code>, <code>{tt("SMTP_FROM")}</code>{" "}{tt("va buyurtmalar keladigan")}{" "}<code>{tt("ORDER_EMAIL_TO")}</code>{" "}{tt("ni yozing, ilovani qayta ishga tushiring va “Test email” tugmasini bosing.")}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <strong className="w-24">{tt("Payme")}</strong>
            <Status ok={!!paymeCredentials()} yes={PROVIDERS.payme.testMode() ? tt("Test rejimi") : tt("Ishchi rejim")} no={tt("Kalitlar yo‘q")} />
            <span className="text-muted">{tt("Merchant API URL:")}{" "}<code>{tt("{base}/api/payments/payme", { base: base })}</code></span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <strong className="w-24">{tt("Click")}</strong>
            <Status ok={!!clickCredentials()} yes={PROVIDERS.click.testMode() ? tt("Test rejimi") : tt("Ishchi rejim")} no={tt("Kalitlar yo‘q")} />
            <span className="text-muted">{tt("Prepare:")}{" "}<code>{tt("{base}/api/payments/click/prepare", { base: base })}</code>{" "}{tt("· Complete:")}{" "}<code>{tt("{base}/api/payments/click/complete", { base: base })}</code></span>
          </div>
          <p className="text-xs text-muted">{tt("Onlayn to‘lovni yoqishdan oldin provayderning test muhitida to‘liq sinovdan o‘tkazing (docs/TOLOV.md).")}</p>
        </div>
      </section>
    </div>
  );
}
