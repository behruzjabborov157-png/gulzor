import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Maxfiylik siyosati" };

export default async function PrivacyPage() {
  const { store } = await getSettings();
  const owner = store.legalName || "Gulzor";
  return (
    <article className="container-page max-w-3xl space-y-5 pt-12 leading-relaxed [&_h2]:mt-8 [&_h2]:text-2xl">
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
        <li>Hisob ochilgan bo‘lsa — parolning shifrlangan (hash) ko‘rinishi; parolning o‘zi saqlanmaydi.</li>
      </ul>
      <h2>Nima uchun ishlatamiz</h2>
      <p>Faqat buyurtmani bajarish, yetkazib berish, buyurtma holati haqida xabar berish va siz rozilik bergan bo‘lsangiz — aksiyalar haqida xabar yuborish uchun.</p>
      <h2>Kimga beriladi</h2>
      <p>
        Ma’lumotlar faqat buyurtmani bajarish uchun zarur bo‘lgan shaxslarga (florist, kuryer) va siz tanlagan to‘lov tizimiga (Payme, Click) beriladi. Karta
        ma’lumotlari Do‘kon serverida saqlanmaydi — to‘lov to‘lov tizimi sahifasida amalga oshiriladi.
      </p>
      <h2>Saqlash muddati va huquqlaringiz</h2>
      <p>
        Siz o‘z ma’lumotlaringizni ko‘rish, tuzatish yoki o‘chirishni so‘rashingiz mumkin. Buning uchun do‘kon bilan bog‘laning
        {store.phone ? `: ${store.phone}` : ""}
        {store.email ? `, ${store.email}` : ""}.
      </p>
      <h2>Cookie fayllar</h2>
      <p>
        Sayt faqat hisobga kirishni saqlash uchun zarur cookie’dan foydalanadi. Savat va sevimlilar brauzeringizning mahalliy xotirasida saqlanadi. Reklama kuzatuvchilari
        ishlatilmaydi.
      </p>
    </article>
  );
}
