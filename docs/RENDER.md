# Gulzor’ni Render’ga (bepul) joylash

Sayt va Telegram bot **bitta** Render web servisda ishlaydi. Bot **webhook** rejimida: Telegram har bir xabarni
saytning `/api/telegram/webhook` manziliga yuboradi, shuning uchun alohida bot dasturi kerak emas.
Ma’lumotlar (buyurtmalar, mahsulotlar, yuklangan rasmlar) **Neon** bepul PostgreSQL bazasida saqlanadi.

> Bu sinov uchun. Haqiqiy mijozlarning shaxsiy ma’lumotlari qonunga ko‘ra O‘zbekistondagi serverda saqlanishi
> kerak — savdoni boshlaganda Toshkent VPS’ga ko‘chiring (`docs/ISHGA-TUSHIRISH.md`).

## Bepul tarif cheklovlari (bilib qo‘ying)

- **15 daqiqa** hech kim kirmasa, servis “uxlaydi”. Keyingi birinchi so‘rov uni taxminan **1 daqiqada** uyg‘otadi
  (bot ham shunda birinchi xabarga kechikib javob beradi). Doim uyg‘oq turishi uchun pastdagi 6-qadam.
- Oyiga 750 soat bepul — bitta servis uchun butun oyga yetadi.
- Render diski har qayta ishga tushganda tozalanadi — shuning uchun rasmlar ham bazada saqlanadi (`MEDIA_STORAGE=db`).
- Email (SMTP) bepul tarifda ishlamaydi; buyurtma xabarlari Telegram’ga keladi.
- Neon bepul bazasi: hajmi kichik (0,5–1 GB), lekin muddati tugamaydi.

## 1. Neon: bepul baza

1. https://neon.com → **Sign up** (GitHub yoki Google bilan).
2. **Create project**: nom `gulzor`, Postgres versiyasi standart, **Region: AWS Europe (Frankfurt)**.
3. Loyiha sahifasida **Connect** → **Connection string** → **Pooled connection** yoqilgan bo‘lsin → satrni nusxalang
   (`postgresql://...-pooler...neon.tech/neondb?sslmode=require` ko‘rinishida). Bu maxfiy — hech kimga bermang.

## 2. Bazani to‘ldirish (kompyuterdan, bir marta)

`.env.local` ga yangi qator qo‘shing (chatga yozmang): `NEON_DATABASE_URL=<nusxalagan satr>`. So‘ng:

```bash
cd C:\Users\USER\gulzor
# PowerShell:
$env:DATABASE_URL = (Select-String -Path .env.local -Pattern '^NEON_DATABASE_URL=(.*)$').Matches[0].Groups[1].Value
npm run setup
npm run admin:create -- --email sizning@email.uz --name "Ism"
Remove-Item Env:DATABASE_URL
```

## 3. Render: hisob va servis

1. https://render.com → **Get Started** → **GitHub bilan kiring** (repo: `behruzjabborov157-png/gulzor`).
2. **New +** → **Blueprint** → `gulzor` reposini tanlang → Render `render.yaml` ni o‘qiydi.
3. So‘ralgan qiymatlarni kiriting (bular faqat Render’da saqlanadi):
   - `DATABASE_URL` — Neon satri (1-qadam);
   - `TELEGRAM_BOT_TOKEN` — @BotFather bergan token;
   - `TELEGRAM_CHAT_ID` — buyurtma xabarlari keladigan chat id.
4. **Apply** → build boshlanadi (5–10 daqiqa). Tugagach manzil chiqadi: `https://gulzor-xxxx.onrender.com`.

## 4. Bot

Sayt ishga tushganda webhook’ni o‘zi ro‘yxatdan o‘tkazadi (`TELEGRAM_AUTO_SETUP=1`). Loglarda
`[telegram] bot sozlandi` chiqadi. Kompyuteringizdagi `npm run telegram:poll` ni to‘xtating — bot bir vaqtda faqat
bir joydan ishlaydi.

## 5. Tekshirish

- `https://<manzil>/api/health` → `{"status":"ok","db":"ok"}`
- Telegram’da botga `/start`.
- `https://<manzil>/admin/kirish` → 2-qadamdagi admin bilan kiring.

## 6. (Ixtiyoriy) uxlamasligi uchun

https://uptimerobot.com (bepul) → **New monitor** → HTTP(s) → `https://<manzil>/api/health`, har **5 daqiqada**.
Bu saytni uyg‘oq tutadi va to‘xtasa sizga xabar beradi.

## Yangilash

GitHub’ga `master` ga push qilinganda Render o‘zi qayta build qiladi va migratsiyalarni qo‘llaydi.
