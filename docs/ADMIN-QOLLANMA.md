# Gulzor — do‘kon egasi uchun qisqa qo‘llanma

Boshqaruv paneli: **https://sizning-domeningiz.uz/admin**

## Ishga tushirishdan oldin
1. **Sozlamalar** — telefon, Telegram username, manzil, ish vaqti va yuridik nomni kiriting.
2. **Yetkazib berish** — faqat haqiqatan yetkazadigan hududlarni yoqing. Har bir hudud uchun narx,
   bepul yetkazish chegarasi, minimal buyurtma, “shu kuni” qabul qilish vaqti va vaqt oraliqlarini belgilang.
3. **Mahsulotlar** — namuna (demo) mahsulotlarni o‘zingizning haqiqiy guldastalaringiz bilan almashtiring:
   o‘z rasmlaringizni yuklang, narx va qoldiqni kiriting. “Namunalarni arxivlash” tugmasi barcha namunalarni yashiradi.
4. **Promokodlar** — `DEMO10` namunaviy kodini o‘chiring.
5. **Sozlamalar** — “Demo rejim banneri”ni o‘chiring.

## Kundalik ish
- **Buyurtmalar**: yangi buyurtma kelganda Telegram’ga xabar keladi (sozlangan bo‘lsa). Buyurtmani oching →
  “Tasdiqlash” → “Tayyorlashni boshlash” → “Tayyor” → “Kuryerga berildi” → “Yetkazildi”.
  Har bir holat mijozning kuzatish sahifasida ko‘rinadi.
- Bekor qilish yoki rad etishda sababni yozing — u mijozga ko‘rinadi, mahsulotlar omborga qaytariladi.
- Naqd to‘lovni olganda buyurtma sahifasida to‘lov holatini “To‘langan” qiling.
  Payme/Click to‘lovlari avtomatik tasdiqlanadi.
- Qidiruv: buyurtma raqami, telefon yoki ism bo‘yicha.

## Narx va qoldiqni tez o‘zgartirish
- **Mahsulotlar** ro‘yxatida narx, ombor soni, mavjudlik va holatni o‘zgartirib, “Saqlash”ni bosing.
- Ko‘p mahsulot uchun: **Import / eksport** → CSV yuklab oling → Excel’da tahrirlang → qayta import qiling.
- Ombor soni bo‘sh qoldirilsa — qoldiq hisobi yuritilmaydi. 0 bo‘lsa — mahsulot “mavjud emas” bo‘ladi.
- Mavsumiy gullar uchun mahsulot sahifasida mavsum oylarini belgilang. Boshqa oylarda u “Mavsumda emas” bo‘ladi va mijozlarga o‘xshash guldastalar taklif qilinadi.

## Do‘konlar (floristlar)
- Floristlar **/florist/royxatdan-otish** sahifasida ariza qoldiradi. Yangi ariza kelganda Telegram’ga xabar keladi,
  admin bosh sahifasida va menyudagi **Do‘konlar** yonida raqam chiqadi.
- **Do‘konlar** → do‘konni oching → yuridik nom va STIR’ni tekshiring → **Tasdiqlash**. Shundan keyin do‘kon va
  uning faol mahsulotlari saytda ko‘rinadi.
- **Rad etish** va **To‘xtatish** uchun sabab yozish shart — florist uni o‘z panelida ko‘radi. To‘xtatilgan do‘konning
  mahsulotlari saytdan yashiriladi, ochiq buyurtmalarni esa florist yakunlay oladi. Keyin qayta tasdiqlash mumkin.
- **Komissiya** (standart 10%) har bir do‘kon uchun alohida. Yangi foiz faqat bundan keyingi buyurtmalarga qo‘llanadi;
  har bir buyurtmada o‘sha paytdagi foiz va summa saqlanadi.
- Gulzor’ning o‘z do‘koni (“Gulzor do‘koni”) profilini shu yerda tahrirlaysiz; uni to‘xtatib bo‘lmaydi.
- Boshqa do‘konlarning mijozlari faqat **yetkazib berishda naqd** to‘laydi (pul to‘g‘ridan-to‘g‘ri do‘konga tushadi).
  Payme/Click, Gulzor promokodlari, xizmat haqi va olib ketish faqat Gulzor’ning o‘z do‘koni uchun.
- Floristlar yangi buyurtmalarni Telegram’da oladi: florist panelida **Profil → Telegram’ni ulash** tugmasini bosadi
  (do‘kon boti, `TELEGRAM_SHOP_BOT_TOKEN`, sozlangan bo‘lishi kerak). SMTP sozlangan bo‘lsa, emailga ham keladi.
  Har bir yuborish natijasi buyurtma sahifasida yoziladi.
- **Komissiya** bo‘limi: oy tugagach oyni tanlab **Hisob chiqarish** ni bosing — har bir do‘konga hisob chiqadi va
  ularga xabar boradi. Do‘kon pulni o‘tkazgach, **To‘landi** ni bosing (izohga to‘lov raqamini yozing).
  Oy oxiridan keyin yetkazilgan buyurtma keyingi oy hisobiga tushadi; bitta buyurtma ikki marta hisoblanmaydi.
- Bu amallarni faqat sayt egasi bajaradi. Kim, qachon, nima qilgani **Jurnal** bo‘limida saqlanadi
  (buyurtma va to‘lov holatini qo‘lda o‘zgartirish ham).

## Muhim
- Faqat o‘zingizga tegishli yoki ruxsat olingan rasmlardan foydalaning.
- Chegirma narxini (“avvalgi narx”) faqat haqiqiy chegirma bo‘lsa kiriting.
- Mijozlar ma’lumotlarini (telefon, manzil) uchinchi shaxslarga bermang.
