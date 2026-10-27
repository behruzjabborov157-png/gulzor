import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Ommaviy oferta" };

export default async function OfferPage() {
  const { store } = await getSettings();
  const seller = store.legalName || "Gulzor";
  return (
    <article className="container-page max-w-3xl space-y-5 pt-12 leading-relaxed [&_h2]:mt-8 [&_h2]:text-2xl">
      <h1 className="text-4xl">Ommaviy oferta</h1>
      <p>Ushbu hujjat {seller} (“Sotuvchi”) va saytda buyurtma beruvchi shaxs (“Xaridor”) o‘rtasidagi gul va sovg‘alarni sotish hamda yetkazib berish shartlarini belgilaydi.</p>
      <h2>1. Buyurtma</h2>
      <p>
        Buyurtma saytda rasmiylashtirilgan va buyurtma raqami berilgan paytdan qabul qilingan hisoblanadi. Sotuvchi gullar mavjudligini tekshirib, zarur bo‘lsa Xaridor
        bilan bog‘lanadi. Biror gul mavjud bo‘lmasa, almashtirish faqat Xaridor roziligi bilan amalga oshiriladi.
      </p>
      <h2>2. Narx va to‘lov</h2>
      <p>
        Narxlar O‘zbekiston so‘mida ko‘rsatiladi. Yakuniy summa (mahsulotlar, yetkazib berish va boshqa to‘lovlar) buyurtma tasdiqlanishidan oldin ko‘rsatiladi. To‘lov
        saytda ko‘rsatilgan usullarda amalga oshiriladi.
      </p>
      <h2>3. Yetkazib berish</h2>
      <p>
        Yetkazib berish Xaridor tanlagan sana va vaqt oralig‘ida amalga oshiriladi. Qabul qiluvchi ko‘rsatilgan manzilda bo‘lmasa yoki telefonga javob bermasa,
        Sotuvchi Xaridor bilan bog‘lanib, qayta yetkazish shartlarini kelishadi.
      </p>
      <h2>4. Sifat va qaytarish</h2>
      <p>
        Gullar tez buziladigan mahsulot hisoblanadi. Agar guldasta sifatiga e’tirozingiz bo‘lsa, qabul qilingan kunning o‘zida fotosurat bilan murojaat qiling — Sotuvchi
        vaziyatni ko‘rib chiqib, almashtirish yoki pulni qaytarish haqida qaror qabul qiladi.
      </p>
      <h2>5. Bekor qilish</h2>
      <p>Buyurtmani tayyorlash boshlangunga qadar bekor qilish mumkin. Oldindan to‘langan summa to‘lov usuli orqali qaytariladi.</p>
    </article>
  );
}
