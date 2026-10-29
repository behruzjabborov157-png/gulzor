# Telegram orqali buyurtma (Mini App)

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
- **webhook** — bot `/start` ga javob berishi uchun (Telegram so‘rovlari maxfiy kalit bilan tekshiriladi).

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
