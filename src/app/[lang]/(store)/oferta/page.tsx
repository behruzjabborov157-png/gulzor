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
