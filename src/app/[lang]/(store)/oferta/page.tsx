import type { Metadata } from "next";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: getDict(locale).meta.offer, alternates: alternates(locale, "/oferta") };
}

export default async function OfferPage() {
  const locale = await getLocale();
  const { store } = await getSettings();
  const seller = store.legalName || "Gulzor";
  return (
    <article className="container-page max-w-3xl space-y-5 pt-12 leading-relaxed [&_h2]:mt-8 [&_h2]:text-2xl">
      {locale === "ru" ? (
        <>
          <h1 className="text-4xl">Публичная оферта</h1>
          <p>
            Настоящий документ определяет условия продажи и доставки цветов и подарков между {seller} («Продавец») и лицом, оформляющим заказ на сайте
            («Покупатель»).
          </p>
          <h2>1. Заказ</h2>
          <p>
            Заказ считается принятым с момента его оформления на сайте и присвоения номера. Продавец проверяет наличие цветов и при необходимости связывается с
            Покупателем. Если какого-то цветка нет, замена производится только с согласия Покупателя.
          </p>
          <h2>2. Цена и оплата</h2>
          <p>
            Цены указаны в узбекских сумах. Итоговая сумма (товары, доставка и прочие платежи) показывается до подтверждения заказа. Оплата производится
            способами, указанными на сайте.
          </p>
          <h2>3. Доставка</h2>
          <p>
            Доставка выполняется в выбранные Покупателем дату и интервал. Если получателя нет по указанному адресу или он не отвечает на звонки, Продавец
            связывается с Покупателем и согласовывает условия повторной доставки.
          </p>
          <h2>4. Качество и возврат</h2>
          <p>
            Цветы — скоропортящийся товар. Если у вас есть претензии к качеству букета, обратитесь в день получения с фотографией — Продавец рассмотрит ситуацию и
            примет решение о замене или возврате денег.
          </p>
          <h2>5. Отмена</h2>
          <p>Заказ можно отменить до начала его сборки. Предоплата возвращается тем же способом оплаты.</p>
        </>
      ) : locale === "en" ? (
        <>
          <h1 className="text-4xl">Terms of sale</h1>
          <p className="text-sm text-muted">This is a translation of the Uzbek text, provided for convenience.</p>
          <p>
            This document sets out the terms of sale and delivery of flowers and gifts between {seller} (the “Seller”) and the person placing an order on the
            website (the “Buyer”).
          </p>
          <h2>1. Order</h2>
          <p>
            An order is accepted from the moment it is placed on the website and given an order number. The Seller checks that the flowers are available and
            contacts the Buyer if necessary. If a flower is not available, it is replaced only with the Buyer’s consent.
          </p>
          <h2>2. Price and payment</h2>
          <p>
            Prices are shown in Uzbek soʻm. The final amount (products, delivery and other charges) is shown before the order is confirmed. Payment is made
            using the methods shown on the website.
          </p>
          <h2>3. Delivery</h2>
          <p>
            Delivery is made on the date and in the time slot chosen by the Buyer. If the recipient is not at the given address or does not answer the phone,
            the Seller contacts the Buyer to agree on the terms of a repeat delivery.
          </p>
          <h2>4. Quality and returns</h2>
          <p>
            Flowers are perishable goods. If you have a complaint about the quality of the bouquet, contact us with a photo on the day you receive it — the
            Seller reviews the situation and decides on a replacement or a refund.
          </p>
          <h2>5. Cancellation</h2>
          <p>An order can be cancelled before its preparation begins. An amount paid in advance is refunded via the payment method used.</p>
        </>
      ) : (
        <>
          <h1 className="text-4xl">Ommaviy oferta</h1>
          <p>
            Ushbu hujjat {seller} (“Sotuvchi”) va saytda buyurtma beruvchi shaxs (“Xaridor”) o‘rtasidagi gul va sovg‘alarni sotish hamda yetkazib berish shartlarini
            belgilaydi.
          </p>
          <h2>1. Buyurtma</h2>
          <p>
            Buyurtma saytda rasmiylashtirilgan va buyurtma raqami berilgan paytdan qabul qilingan hisoblanadi. Sotuvchi gullar mavjudligini tekshirib, zarur bo‘lsa
            Xaridor bilan bog‘lanadi. Biror gul mavjud bo‘lmasa, almashtirish faqat Xaridor roziligi bilan amalga oshiriladi.
          </p>
          <h2>2. Narx va to‘lov</h2>
          <p>
            Narxlar O‘zbekiston so‘mida ko‘rsatiladi. Yakuniy summa (mahsulotlar, yetkazib berish va boshqa to‘lovlar) buyurtma tasdiqlanishidan oldin ko‘rsatiladi.
            To‘lov saytda ko‘rsatilgan usullarda amalga oshiriladi.
          </p>
          <h2>3. Yetkazib berish</h2>
          <p>
            Yetkazib berish Xaridor tanlagan sana va vaqt oralig‘ida amalga oshiriladi. Qabul qiluvchi ko‘rsatilgan manzilda bo‘lmasa yoki telefonga javob bermasa,
            Sotuvchi Xaridor bilan bog‘lanib, qayta yetkazish shartlarini kelishadi.
          </p>
          <h2>4. Sifat va qaytarish</h2>
          <p>
            Gullar tez buziladigan mahsulot hisoblanadi. Agar guldasta sifatiga e’tirozingiz bo‘lsa, qabul qilingan kunning o‘zida fotosurat bilan murojaat qiling —
            Sotuvchi vaziyatni ko‘rib chiqib, almashtirish yoki pulni qaytarish haqida qaror qabul qiladi.
          </p>
          <h2>5. Bekor qilish</h2>
          <p>Buyurtmani tayyorlash boshlangunga qadar bekor qilish mumkin. Oldindan to‘langan summa to‘lov usuli orqali qaytariladi.</p>
        </>
      )}
    </article>
  );
}
