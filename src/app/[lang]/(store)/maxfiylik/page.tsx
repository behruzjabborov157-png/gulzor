import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: getDict(locale).meta.privacy, alternates: alternates(locale, "/maxfiylik") };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const { store } = await getSettings();
  const owner = store.legalName || "Gulzor";
  const contact = `${store.phone ? `: ${store.phone}` : ""}${store.email ? `, ${store.email}` : ""}`;
  return (
    <article className="container-page max-w-3xl space-y-5 pt-12 leading-relaxed [&_h2]:mt-8 [&_h2]:text-2xl">
      {locale === "ru" ? (
        <>
          <h1 className="text-4xl">Политика конфиденциальности</h1>
          <p>
            Эта политика объясняет, как {owner} (далее — «Магазин») собирает, использует и защищает персональные данные, которые вы указываете при
            оформлении заказа на сайте. Данные обрабатываются в соответствии с Законом Республики Узбекистан «О персональных данных».
          </p>
          <h2>Какие данные мы собираем</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>Имя и номер телефона заказчика;</li>
            <li>Имя, номер телефона и адрес доставки получателя;</li>
            <li>Состав заказа, текст открытки и комментарии для курьера;</li>
            <li>Если создан аккаунт — имя, номер телефона, зашифрованный (хеш) вид пароля (сам пароль не хранится), сохранённые адреса и избранное;</li>
            <li>Заявка на индивидуальный букет — имя, телефон, описание и (по желанию) фото-пример; фото видят только сотрудники Магазина;</li>
            <li>Подписка на новости — номер телефона и текст согласия, который вы подтвердили.</li>
          </ul>
          <h2>Для чего мы их используем</h2>
          <p>Только для выполнения и доставки заказа, уведомлений о его статусе и — если вы дали согласие — для сообщений об акциях.</p>
          <h2>Кому передаются данные</h2>
          <p>
            Данные передаются только тем, кто нужен для выполнения заказа (флорист, курьер), и выбранной вами платёжной системе (Payme, Click). Данные карты
            не хранятся на сервере Магазина — оплата проходит на странице платёжной системы.
          </p>
          <h2>Срок хранения и ваши права</h2>
          <p>Вы можете запросить просмотр, исправление или удаление своих данных. Для этого свяжитесь с магазином{contact}.</p>
          <p>
            Аккаунт можно удалить самостоятельно на странице{" "}
            <Link href={localePath(locale, "/hisobni-ochirish")} className="text-forest underline">
              «Удаление аккаунта»
            </Link>
            : аккаунт, сохранённые адреса и избранное удаляются сразу. Оформленные заказы хранятся столько, сколько нужно для их выполнения и
            бухгалтерского учёта, но больше не связаны с аккаунтом.
          </p>
          <h2>Файлы cookie</h2>
          <p>
            Сайт использует только cookie, необходимый для входа в аккаунт. Корзина и избранное (без аккаунта) хранятся в памяти вашего браузера. Рекламные трекеры не
            используются.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-4xl">Maxfiylik siyosati</h1>
          <p>
            Ushbu siyosat {owner} (keyingi o‘rinlarda — “Do‘kon”) saytida buyurtma berishda siz taqdim etadigan shaxsga doir ma’lumotlar qanday yig‘ilishi, ishlatilishi va
            himoya qilinishini tushuntiradi. Ma’lumotlar O‘zbekiston Respublikasining “Shaxsga doir ma’lumotlar to‘g‘risida”gi Qonuniga muvofiq qayta ishlanadi.
          </p>
          <h2>Qanday ma’lumotlarni yig‘amiz</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>Buyurtmachining ismi va telefon raqami;</li>
            <li>Qabul qiluvchining ismi, telefon raqami va yetkazib berish manzili;</li>
            <li>Buyurtma tarkibi, otkritka matni va kuryer uchun izohlar;</li>
            <li>Hisob ochilgan bo‘lsa — ism, telefon raqami, parolning shifrlangan (hash) ko‘rinishi (parolning o‘zi saqlanmaydi), saqlangan manzillar va sevimlilar;</li>
            <li>Maxsus guldasta so‘rovi — ism, telefon, tavsif va (xohishga ko‘ra) namuna rasm; rasmni faqat Do‘kon xodimlari ko‘radi;</li>
            <li>Yangiliklarga obuna — telefon raqami va siz tasdiqlagan rozilik matni.</li>
          </ul>
          <h2>Nima uchun ishlatamiz</h2>
          <p>Faqat buyurtmani bajarish, yetkazib berish, buyurtma holati haqida xabar berish va siz rozilik bergan bo‘lsangiz — aksiyalar haqida xabar yuborish uchun.</p>
          <h2>Kimga beriladi</h2>
          <p>
            Ma’lumotlar faqat buyurtmani bajarish uchun zarur bo‘lgan shaxslarga (florist, kuryer) va siz tanlagan to‘lov tizimiga (Payme, Click) beriladi. Karta
            ma’lumotlari Do‘kon serverida saqlanmaydi — to‘lov to‘lov tizimi sahifasida amalga oshiriladi.
          </p>
          <h2>Saqlash muddati va huquqlaringiz</h2>
          <p>Siz o‘z ma’lumotlaringizni ko‘rish, tuzatish yoki o‘chirishni so‘rashingiz mumkin. Buning uchun do‘kon bilan bog‘laning{contact}.</p>
          <p>
            Hisobingizni o‘zingiz{" "}
            <Link href={localePath(locale, "/hisobni-ochirish")} className="text-forest underline">
              “Hisobni o‘chirish”
            </Link>{" "}
            sahifasida o‘chirishingiz mumkin: hisob, saqlangan manzillar va sevimlilar darhol o‘chiriladi. Berilgan buyurtmalar ularni bajarish va
            buxgalteriya hisobi uchun zarur muddat davomida saqlanadi, lekin hisobga bog‘lanmaydi.
          </p>
          <h2>Cookie fayllar</h2>
          <p>
            Sayt faqat hisobga kirishni saqlash uchun zarur cookie’dan foydalanadi. Savat va sevimlilar (hisobsiz) brauzeringizning mahalliy xotirasida saqlanadi. Reklama kuzatuvchilari
            ishlatilmaydi.
          </p>
        </>
      )}
    </article>
  );
}
