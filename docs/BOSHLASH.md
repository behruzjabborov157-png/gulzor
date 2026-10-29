# Gulzor — yangi boshlovchi uchun qo‘llanma (Windows)

Bu qo‘llanma dasturlashni bilmaydigan do‘kon egasi uchun. Har bir buyruqni **PowerShell**’ga
(Windows menyusida “PowerShell” deb qidiring) nusxalab, Enter bosing.

Boshqa qo‘llanmalar:
- Saytni internetga chiqarish — `docs/ISHGA-TUSHIRISH.md`
- Android ilova va Google Play — `docs/ANDROID-ILOVA.md`, `docs/play-store/README.md`
- Telegram orqali buyurtma (bot tugmalari va «Do‘kon» Mini App) — `docs/TELEGRAM-MINI-APP.md`

---

## 1. Kompyuterda birinchi marta ishga tushirish

1. **Node.js** o‘rnating: <https://nodejs.org> → “LTS” versiyasi → o‘rnatib, kompyuterni qayta yoqing.
2. PowerShell’ni oching va loyiha papkasiga o‘ting:
   ```powershell
   cd C:\Users\USER\gulzor
   ```
3. Faqat **birinchi marta** (yoki loyiha yangilangandan keyin):
   ```powershell
   npm install
   npm run setup
   ```
   `npm run setup` bazani yaratadi va namuna mahsulotlarni qo‘shadi. Qayta ishlatsangiz, mavjud
   ma’lumotlarga tegmaydi.
4. Saytni ishga tushiring:
   ```powershell
   npm run dev
   ```
   Brauzerda oching: <http://localhost:3000> (ruscha: <http://localhost:3000/ru>).
   To‘xtatish — PowerShell oynasida **Ctrl + C**.

> Kompyuterdagi baza `storage` papkasida saqlanadi. U **faqat sinov uchun**: haqiqiy do‘kon
> serverda PostgreSQL bilan ishlaydi.

## 2. Admin (do‘kon egasi) hisobini yaratish

Avval saytni to‘xtating (**Ctrl + C**) — kompyuterdagi baza bir vaqtda faqat bitta dastur bilan ishlaydi.
```powershell
npm run admin:create -- --email sizning@email.uz --name "Ismingiz"
```
Parol so‘raladi (kamida 12 belgi). Keyin `npm run dev` va <http://localhost:3000/admin> orqali kiring.
Parolni unutsangiz — xuddi shu buyruqni qayta bajaring, yangi parol o‘rnatiladi.

## 3. Sinov buyurtma: mijozdan sizgacha

1. Saytda guldasta tanlang → **Savatga qo‘shish** (o‘ngda savat oynasi ochiladi) → **Savatga o‘tish**.
2. Yetkazib berish hududini tanlang → **Rasmiylashtirish**.
3. Ism, telefon, manzil, sana va vaqtni kiriting → **Davom etish** → tekshirib, **Buyurtmani tasdiqlash**.
4. Ekranda buyurtma raqami (masalan `GZ-261029-1234`) chiqadi — bu buyurtma **bazaga yozilganidan keyin** ko‘rsatiladi.
5. Admin panel → **Buyurtmalar**: yangi buyurtma ro‘yxatda, menyuda pushti raqam bilan ko‘rinadi.
   Ochib, **Tasdiqlash** tugmasini bosing — mijozning buyurtma sahifasida holat o‘zgaradi.

Buyurtmalar har doim avval bazaga yoziladi. Telegram yoki email ishlamay qolsa ham buyurtma yo‘qolmaydi:
admin paneldagi buyurtma sahifasida “Bildirishnomalar” bo‘limida xato ko‘rinadi va **qayta yuborish** tugmasi bor.

## 4. Buyurtmalar Telegram’ga kelishi uchun

1. Telegram’da **@BotFather** → `/newbot` → bot nomini yozing → **token** beriladi (`123456:ABC...`).
2. Yangi botingizga istalgan xabar yozing.
3. Brauzerda oching (TOKEN o‘rniga o‘zingiznikini qo‘ying):
   `https://api.telegram.org/botTOKEN/getUpdates` → `"chat":{"id": 123456789` — shu raqam **chat id**.
4. Loyiha papkasidagi `.env.local` faylni Bloknot (Notepad) bilan oching va yozing:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC...
   TELEGRAM_CHAT_ID=123456789
   ```
5. Saytni qayta ishga tushiring → Admin → **Sozlamalar** → **Test xabar yuborish**. Telegram’ga xabar kelsa — tayyor.

## 5. Buyurtmalar emailga ham kelishi uchun (ixtiyoriy)

`.env.local` faylga pochta (SMTP) ma’lumotlarini yozing. Masalan, Gmail uchun avval Google hisobida
2 bosqichli himoyani yoqing va **App password** (ilova paroli) yarating:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=sizning@gmail.com
SMTP_PASS=ilova-paroli-16-belgi
SMTP_FROM=sizning@gmail.com
ORDER_EMAIL_TO=buyurtmalar-keladigan@email.uz
```
Saytni qayta ishga tushiring → Admin → **Sozlamalar** → **Test email yuborish**.

> `.env.local` dagi parol va tokenlarni hech kimga yubormang va GitHub’ga yuklamang
> (repozitoriy ochiq — u yerdagi hamma narsani hamma ko‘radi; `.env.local` u yerga avtomatik tushmaydi).

## 6. Do‘kon ma’lumotlari (kod o‘zgartirmasdan)

Admin → **Sozlamalar**: telefon, Telegram username, manzil, ish vaqti, yuridik nom (o‘zbekcha va ruscha).
Shu yerda **to‘lov usullari** va **demo banner** ham bor — haqiqiy mahsulotlar qo‘yilgach, demo bannerni o‘chiring.

Admin → **Yetkazib berish**: hududlar, narxlar, bepul yetkazish chegarasi, minimal buyurtma,
bugungi buyurtmalar uchun qabul muddati va vaqt oraliqlari. Saytdagi FAQ va “Qayerga yetkazamiz?”
bo‘limi shu ma’lumotlardan avtomatik to‘ladi.

## 7. Mahsulotlar va fotosuratlar

Hozirgi 46 ta mahsulot — **namuna** (“Namuna mahsulot” deb belgilangan). Ularni o‘zingiznikiga almashtiring:
Admin → **Mahsulotlar** → tahrirlash yoki **Namunalarni arxivlash**.

Yaxshi mahsulot fotosurati uchun:
- **Vertikal** (bo‘yi enidan katta, taxminan 4:5), kamida 1200 piksel eni.
- Kunduzgi yorug‘lik, tekis och fon (oq, krem yoki och pushti devor).
- Har bir guldasta uchun 2–4 rasm: umumiy ko‘rinish, yaqindan, qo‘lda (o‘lchamni ko‘rsatish uchun).
- Faqat **o‘zingiz yig‘gan** guldastalarning rasmini qo‘ying — mijoz aynan shuni kutadi.

Bosh sahifadagi katta bezak rasmlar (`public/images/editorial`) — Unsplash’dan, kayfiyat uchun;
ular mahsulot sifatida sotilmaydi. Mualliflari `/rasm-mualliflari` sahifasida. O‘zingizning professional
suratlaringiz bo‘lsa, shu nomlar bilan almashtirish mumkin.

## 8. Sharhlar haqida

Sharhni faqat **buyurtmasi yetkazilgan mijoz** o‘z buyurtma sahifasidan qoldira oladi (har buyurtmaga bitta).
Sharh avval **Admin → Sharhlar** da tekshiriladi, keyin do‘kon va mahsulot sahifasida chiqadi. Sharh bo‘lmasa,
bo‘lim umuman ko‘rinmaydi. O‘zingiz sharh yozmang va past bahoni yashirmang — soxta sharh qonun va Google
qoidalariga zid; faqat haqorat, shaxsiy ma’lumot, reklama yoki spamni rad eting.

## 9. Tekshiruvlar (dasturchi uchun)

```powershell
npm run typecheck   # TypeScript
npm run lint        # kod uslubi
npm test            # 24 ta unit/integratsiya testi (buyurtma, to‘lov, email, takroriy yuborish)
npm run build       # production build
```
Brauzer testlari (34 ta) — `README.md`, “Testing” bo‘limi.

## 10. Muammolar

| Belgi | Yechim |
|---|---|
| `EADDRINUSE` / port band | Boshqa oynada sayt allaqachon ishlayapti — o‘sha oynani yoping yoki Ctrl + C. |
| Buyruq bazaga ulana olmadi | Sayt ishlab turibdi — avval Ctrl + C bilan to‘xtating (kompyuterdagi baza bir vaqtda bitta dastur bilan ishlaydi). |
| Admin parol qabul qilmayapti | Katta-kichik harflarni tekshiring. 5 marta xato kiritilsa, 15 daqiqa kuting yoki parolni `admin:create` bilan qayta o‘rnating. |
| Telegram xabar kelmayapti | Sozlamalar → “Test xabar”: chiqqan xato matnini o‘qing (token yoki chat id noto‘g‘ri bo‘lishi mumkin). |
