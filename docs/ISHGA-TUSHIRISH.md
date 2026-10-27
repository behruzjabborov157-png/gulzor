# Gulzor’ni ishga tushirish — qadamma-qadam qo‘llanma

Bu qo‘llanma saytni internetga chiqarish uchun. Buyruqlar Ubuntu 24.04 serveri uchun yozilgan.
Agar dasturchi yordam bersa, unga shu faylni ko‘rsating.

---

## 0. Oldindan tayyorlab qo‘yiladigan narsalar

| Nima | Qayerdan | Izoh |
|---|---|---|
| **Domen** (masalan `gulzor.uz`) | .uz domen ro‘yxatdan o‘tkazuvchilari | DNS’da `A` yozuvi server IP manziliga yo‘naltiriladi |
| **Server (VPS)** | **O‘zbekistondagi** data-markaz | Kamida 2 GB RAM, 2 CPU, 40 GB disk, Ubuntu 24.04. Qonun bo‘yicha fuqarolarning shaxsiy ma’lumotlari O‘zbekistondagi serverda saqlanishi kerak — huquqshunos bilan tasdiqlang |
| **Telegram bot** | @BotFather | Buyurtmalar haqida xabar olish uchun |
| **Telegram username yoki telefon** | — | Mijozlar siz bilan bog‘lanishi uchun |
| Payme / Click (ixtiyoriy) | Provayderlar bilan shartnoma | Onlayn to‘lov uchun. Bo‘lmasa — naqd to‘lov ishlaydi |

---

## 1. Serverni tayyorlash

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx postgresql certbot python3-certbot-nginx git gh
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v          # v22.x bo‘lishi kerak

# gulzor foydalanuvchisi: uy papkasi /home/gulzor, dastur esa alohida — bo‘sh /opt/gulzor papkasida
sudo useradd --system --create-home --shell /bin/bash gulzor
sudo mkdir -p /opt/gulzor /var/lib/gulzor/uploads /var/backups/gulzor
sudo chown -R gulzor:gulzor /opt/gulzor /var/lib/gulzor /var/backups/gulzor
```

## 2. Ma’lumotlar bazasi (PostgreSQL)

Kuchli parol o‘ylab toping (pastdagi `PAROL` o‘rniga). Baza **albatta UTF8** bo‘lishi kerak —
aks holda kirill yoki boshqa yozuvdagi ismlar saqlanmaydi (migratsiya bunday bazada ishlamaydi).

```bash
sudo -u postgres psql -c "CREATE USER gulzor WITH PASSWORD 'PAROL';"
sudo -u postgres psql -c "CREATE DATABASE gulzor OWNER gulzor ENCODING 'UTF8' LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8' TEMPLATE template0;"
```

## 3. Dasturni joylash

```bash
sudo -iu gulzor                       # gulzor foydalanuvchisi nomidan ishlash

# Repozitoriy yopiq (private) — avval GitHub’ga kiring (bir martalik):
gh auth login --web --git-protocol https
gh auth setup-git

cd /opt/gulzor
git clone https://github.com/behruzjabborov157-png/gulzor.git .   # oxiridagi nuqta muhim
npm ci
cp .env.example .env.local
chmod 600 .env.local
nano .env.local
```

`.env.local` ichida kamida quyidagilar:

```
NEXT_PUBLIC_SITE_URL=https://gulzor.uz
DATABASE_URL=postgres://gulzor:PAROL@localhost:5432/gulzor
UPLOAD_DIR=/var/lib/gulzor/uploads
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

(Telegram token va chat id’ni olish — `README.md`, 6-bo‘lim.)

## 4. Bazani to‘ldirish va egasi hisobini yaratish

Toza boshlash (namuna mahsulotlarsiz) — tavsiya etiladi:

```bash
npm run db:migrate
npm run db:seed -- --no-demo        # kategoriyalar, vaqt oraliqlari, sozlamalar
npm run admin:create -- --email siz@gulzor.uz --name "Ismingiz" --role owner
```

> Namuna mahsulotlar bilan ko‘rib chiqmoqchi bo‘lsangiz: `npm run db:seed` (keyin ularni arxivlaysiz).

## 5. Build va ishga tushirish

```bash
npm run build
exit                                  # oddiy foydalanuvchiga qaytish
sudo cp /opt/gulzor/deploy/gulzor.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now gulzor
curl -s http://127.0.0.1:3000/api/health      # {"status":"ok","db":"ok",...}
```

## 6. nginx va HTTPS

`deploy/nginx.conf` faylida `gulzor.uz` ni o‘z domeningizga almashtiring:

```bash
sudo cp /opt/gulzor/deploy/nginx.conf /etc/nginx/sites-available/gulzor
sudo ln -s /etc/nginx/sites-available/gulzor /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d gulzor.uz -d www.gulzor.uz
```

Endi `https://gulzor.uz` ochilishi kerak.

## 7. Admin panelda sozlash (`https://gulzor.uz/admin`)

1. **Sozlamalar** — telefon, Telegram username, manzil, ish vaqti, yuridik nom. “Test xabar yuborish” → Telegram’ga xabar kelishini tekshiring.
2. **Yetkazib berish** — haqiqiy hududlar va narxlarni kiriting, keyin ularni **Faol** qiling.
3. **Mahsulotlar** — mahsulotlarni qo‘shing (rasm bilan) yoki **Import / eksport** orqali CSV shablonni to‘ldirib yuklang.
4. **Sozlamalar** — “Demo rejim banneri” o‘chiq ekanini tekshiring.

## 8. Yakuniy tekshiruv

```bash
sudo -iu gulzor bash -c "cd /opt/gulzor && npm run launch:check -- --send-test"
```

Natijada **0 failed** bo‘lishi kerak. Ogohlantirishlarni (WARN) ko‘rib chiqing. So‘ng o‘zingiz
telefondan bitta sinov buyurtma bering → Telegram’ga xabar kelganini va admin panelda ko‘rinishini
tekshiring → sinov buyurtmani “Bekor qilish” qiling.

## 9. Zaxira nusxa va kuzatuv

```bash
sudo chmod +x /opt/gulzor/deploy/backup.sh
sudo -u gulzor crontab -e
# qo‘shing:
15 3 * * * /opt/gulzor/deploy/backup.sh >> /var/backups/gulzor/backup.log 2>&1
```

- Zaxira nusxalarni haftada bir marta boshqa joyga ham ko‘chiring (bitta disk — zaxira emas).
- Saytning ishlayotganini kuzatish: UptimeRobot kabi bepul xizmatga `https://gulzor.uz/api/health` manzilini qo‘shing — sayt to‘xtasa sizga xabar keladi.

## 10. Yangilash

```bash
sudo -iu gulzor
cd /opt/gulzor && git pull && npm ci && npm run db:migrate && npm run build
exit
sudo systemctl restart gulzor
```

## 11. Keyinroq: onlayn to‘lov

Payme yoki Click bilan shartnoma tuzgach — `README.md`, 7-bo‘lim. Avval provayderning test
muhitida to‘liq sinab ko‘ring, keyin **Sozlamalar**da yoqing.
