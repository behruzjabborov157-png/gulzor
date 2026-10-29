# Telegram orqali buyurtma: bot va Mini App

Mijozlar Telegram’da ikki usulda buyurtma bera oladi:

1. **Botning o‘zida, tugmalar bilan** (Evos/Bellissimo uslubida) — ko‘pchilik mijozlar uchun eng qulayi.
2. **«Do‘kon» tugmasi (Mini App)** — sayt Telegram ichida ochiladi; xohlagan mijoz undan foydalanadi.

Ikkalasi ham saytdagi bilan **bir xil baza va bir xil server kodi**dan foydalanadi: admin panelda narx, mahsulot,
qoldiq, hudud yoki vaqt oralig‘ini o‘zgartirsangiz — botda ham darhol o‘zgaradi. Buyurtmalar sizga **oldingidek** keladi.

## Botda buyurtma — qanday ishlaydi

| Qadam | Mijoz ko‘radigan narsa |
|---|---|
| `/start` | Til tanlash: 🇺🇿 O‘zbekcha / 🇷🇺 Русский |
| Menyu | 🌸 Katalog · 🛒 Savat · 📦 Buyurtmalarim · 📞 Aloqa · 🌐 Til |
| Katalog | Bo‘limlar (Guldastalar, Atirgullar, Lolalar, Qutidagi, Savatdagi gullar, O‘simliklar, Sovg‘alar) → guldastalar ro‘yxati narxi bilan |
| Mahsulot | Rasm, tavsif, narx; o‘lcham tugmalari, gullar soni ➖/➕, rang, miqdor ➖/➕; «🛒 Savatga · narx» |
| Savat | Ro‘yxat va summa; ❌ o‘chirish, 🧹 tozalash, ✅ Rasmiylashtirish |
| Telefon | «📱 Raqamni yuborish» tugmasi (yoki qo‘lda yozish) |
| Qabul qiluvchi | 🙋 O‘zim / 🎁 Boshqa odam (ismi va telefoni) |
| Manzil | Hudud tugmalari (narxi bilan) → manzilni yozish yoki «📍 Lokatsiyani yuborish» (+ kvartira/mo‘ljal) |
| Vaqt | Kun tugmalari → faqat **bo‘sh** vaqt oraliqlari |
| Otkritka | Matn yoziladi yoki «⏭ O‘tkazib yuborish» |
| To‘lov | Sozlamalarda yoqilgan usullar (naqd; Payme/Click — ulangan bo‘lsa, «💳 To‘lash» tugmasi bilan) |
| Tasdiqlash | To‘liq xulosa va jami summa → ✅ Tasdiqlash |
| Keyin | Bot buyurtma raqamini yuboradi; har bir holat o‘zgarishida mijozga xabar boradi |

- Narx, yetkazish narxi va bo‘sh vaqtlar **serverda** hisoblanadi (sayt bilan bir xil); eski tugmalar qayta bosilsa ham
  takroriy buyurtma yaratilmaydi.
- Mijoz lokatsiya yuborsa, sizga keladigan xabarda va admin panelda **Yandex/Google xarita** havolalari bo‘ladi.
- 📦 Buyurtmalarim — mijozning botdagi so‘nggi 5 ta buyurtmasi va holati.
- 📞 Aloqa — Admin → Sozlamalardagi telefon, Telegram, manzil va ish vaqti.
- Mijozning tili, savati va qaysi qadamda turgani bazada saqlanadi — server qayta ishga tushsa ham yo‘qolmaydi.

Hozircha botda sovg‘a qo‘shimchalari (shokolad, o‘yinchoq) alohida tanlanmaydi — ular «Sovg‘alar» bo‘limidan oddiy mahsulot sifatida qo‘shiladi.

---

# Mini App («Do‘kon» tugmasi)

Mijoz Telegram’da botingizni ochadi → pastdagi **«Do‘kon»** tugmasini bosadi → saytingiz Telegram ichida ochiladi.
Ism Telegram’dan avtomatik olinadi, telefon — bitta tugma bilan (Telegram mijozdan ruxsat so‘raydi).
Buyurtma **oddiy sayt buyurtmasi kabi** bazaga yoziladi va sizga **oldingidek** Telegram (va email) orqali keladi.

## Nima qo‘shildi

| Imkoniyat | Qanday ishlaydi |
|---|---|
| «Do‘kon» tugmasi | Bot chatining pastida; bosilganda sayt Telegram ichida ochiladi |
| Telegram’ga moslashish | Sayt Telegram ichida ekanini o‘zi aniqlaydi: ekranni to‘liq egallaydi, ranglar mos, ichki sahifalarda Telegram’ning «Orqaga» tugmasi ishlaydi |
| Ism | Buyurtma formasida Telegram’dagi ism avtomatik yoziladi (o‘zgartirish mumkin) |
| Telefon | «Telegram raqamimni ulashish» tugmasi → Telegram ruxsat so‘raydi → raqam formaga tushadi |
| Til | Telegram’i rus tilida bo‘lgan mijozlar uchun sayt ruscha ochiladi |
| Sizga xabar | Avvalgidek; endi xabarda mijozning Telegram’i ham bor — bosib, unga to‘g‘ridan-to‘g‘ri yozasiz |
| Mijozga xabar | Bot mijozga «Buyurtmangiz qabul qilindi» va har bir holat o‘zgarishini (Tasdiqlandi, Yo‘lda, Yetkazildi…) yuboradi |
| `/start` | Bot salomlashadi va «Do‘konni ochish» tugmasini yuboradi |

**Xavfsizlik:** Telegram yuborgan ma’lumot serverda **bot tokeni bilan imzosi tekshiriladi**. Soxta ma’lumot bilan
boshqa birovning Telegram akkauntiga buyurtma bog‘lab bo‘lmaydi (bunday holda buyurtma oddiy sayt buyurtmasi bo‘lib qoladi).
Telegram’dan kelgan telefon raqami faqat formani to‘ldiradi — mijoz uni ko‘rib, o‘zgartirishi mumkin.

---

## Qaysi bot?

Sizda hozir **@orvelia_uz_bot** bor — u **sizga** buyurtma xabarlarini yuboradi. Mijozlar uchun ikki yo‘l bor:

**A) Mijozlar uchun alohida «Gulzor» boti — tavsiya qilinadi**
- Mijozlar bot nomini, rasmini va username’ini ko‘radi. «orvelia» nomi Gulzor brendiga mos emas,
  username’ni esa keyin **o‘zgartirib bo‘lmaydi**.
- Yangi bot (masalan `@GulzorUzBot`, `@gulzor_gullar_bot`) — mijozlar uchun do‘kon.
- @orvelia_uz_bot — faqat sizga buyurtma xabarlari uchun qoladi (mijozlar uni bilmaydi).

**B) Bitta bot hammasi uchun** — @orvelia_uz_bot ham do‘kon, ham sizga xabar yuboradi.
Qo‘shimcha bot kerak emas, lekin mijozlar «orvelia» nomini ko‘radi.

Quyidagi qadamlar **A** variant uchun. B variantda 1-qadamni o‘tkazib yuboring va `TELEGRAM_SHOP_BOT_TOKEN` ni bo‘sh qoldiring.

---

## 1. Do‘kon botini yaratish (hozir qilsa bo‘ladi)

Telegram → **@BotFather** (ko‘k tasdiq belgisi bilan):
1. `/newbot` → nomi: `Gulzor — gul do‘koni` → username: masalan `GulzorUzBot` (`bot` bilan tugashi shart, band bo‘lmasligi kerak).
2. Berilgan **tokenni hech kimga yubormang va chatga yozmang** — keyin to‘g‘ridan-to‘g‘ri serverdagi faylga yozamiz.
3. `/setuserpic` → botni tanlang → rasm yuboring (Gulzor ikonkasi: `docs/play-store/play-icon-512.png`).

Bot nomi, tavsifi va «Do‘kon» tugmasini o‘zingiz qo‘lda sozlashingiz shart emas — 3-qadamdagi buyruq hammasini qiladi.

## 2. Server sozlamalari (sayt HTTPS’da ishga tushgandan keyin)

> Telegram Mini App **faqat HTTPS saytda** ishlaydi. Shu kompyuterdagi `http://localhost` ni Telegram ochmaydi —
> shuning uchun bu qadamlar sayt domenda ishga tushgach bajariladi (`docs/ISHGA-TUSHIRISH.md`).

Serverdagi `/opt/gulzor/.env.local` fayliga qo‘shing:
```bash
TELEGRAM_SHOP_BOT_TOKEN=<do‘kon botining tokeni>
TELEGRAM_WEBHOOK_SECRET=<tasodifiy maxfiy kalit>
```
Maxfiy kalitni yaratish (serverda):
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```
`TELEGRAM_BOT_TOKEN` va `TELEGRAM_CHAT_ID` (sizga xabarlar uchun) avvalgidek qoladi.
So‘ng saytni qayta ishga tushiring: `sudo systemctl restart gulzor`.

## 3. Botni bitta buyruq bilan sozlash

```bash
sudo -iu gulzor bash -c "cd /opt/gulzor && npm run telegram:setup"
```
Buyruq quyidagilarni qiladi va har birini ✔ bilan ko‘rsatadi:
- pastki menyuga **«Do‘kon»** tugmasini qo‘yadi (saytingizga havola bilan);
- `/start` buyrug‘i, botning qisqa va to‘liq tavsifi (o‘zbekcha va ruscha);
- **webhook** — bot xabarlar va tugma bosishlariga javob berishi uchun (Telegram so‘rovlari maxfiy kalit bilan tekshiriladi).

Buyruqni istalgancha qayta ishlatish mumkin (masalan, domen o‘zgarsa).

**Ixtiyoriy:** @BotFather → `/mybots` → botingiz → **Bot Settings → Configure Mini App** → yoqing va sayt manzilini kiriting.
Shunda bot profilida katta **«Open»** tugmasi paydo bo‘ladi va `https://t.me/BotUsername?startapp` havolasi to‘g‘ridan-to‘g‘ri do‘konni ochadi
(Instagram bio, vizitka va QR-kod uchun qulay).

## 4. Tekshirish

1. Telefoningizda `https://t.me/<bot username>` → **Start** — salomlashuv xabari va «Do‘konni ochish» tugmasi kelishi kerak.
2. Pastdagi **«Do‘kon»** tugmasi → sayt Telegram ichida ochiladi.
3. Guldasta → savat → rasmiylashtirish: ism avtomatik yozilgan; **«Telegram raqamimni ulashish»** → ruxsat bering → raqam to‘ladi.
4. Buyurtmani tasdiqlang:
   - sizga (orvelia boti orqali) **🌸 Yangi buyurtma** keladi, ichida mijozning Telegram’i bor;
   - mijozga (do‘kon boti orqali) **«Buyurtmangiz qabul qilindi»** keladi.
5. Admin panelda buyurtmani **Tasdiqlash** — mijozga «Buyurtma …: Tasdiqlandi» xabari boradi.
   Admin → buyurtma → «Bildirishnomalar» bo‘limida har bir xabarning natijasi ko‘rinadi.

## Muammolar

| Belgi | Sabab va yechim |
|---|---|
| `telegram:setup`: «https:// bilan boshlanishi kerak» | `NEXT_PUBLIC_SITE_URL` hali `http://` — sayt HTTPS bilan ishga tushgach qayta urining. |
| «Do‘kon» tugmasi yo‘q | `telegram:setup` ishlatilmagan yoki xato bergan; Telegram ilovasini yopib-ochib ko‘ring. |
| `/start` ga javob yo‘q | `npm run telegram:setup` oxiridagi «Webhook» qatorida xato bormi — ko‘pincha HTTPS sertifikati yoki `TELEGRAM_WEBHOOK_SECRET`. |
| Buyurtma keladi, lekin unda mijozning Telegram’i yo‘q | `TELEGRAM_SHOP_BOT_TOKEN` boshqa botniki — Mini App qaysi botdan ochilgan bo‘lsa, o‘sha bot tokeni kerak. |
| «Raqamni ulashish» ishlamadi | Mijozning Telegram ilovasi juda eski; raqamni qo‘lda yozish mumkin. |
| Mijozga holat xabari kelmayapti | Admin → buyurtma → Bildirishnomalar: xato matnini o‘qing (masalan, mijoz botni bloklagan). |

Telegram orqali berilgan buyurtmalar uchun maxfiylik siyosatiga tegishli band qo‘shilgan (`/maxfiylik`).
