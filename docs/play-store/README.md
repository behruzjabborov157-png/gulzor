# Google Play materiallari — Gulzor

Bu papkada Google Play Console’dagi **do‘kon sahifasi** (Store listing) va **App content** bo‘limlari uchun
tayyor matnlar, grafikalar va javoblar bor. Ilovani yasash va yuklash tartibi — `docs/ANDROID-ILOVA.md`.

> ⚠️ Matnlarda faqat saytda **haqiqatan ishlaydigan** imkoniyatlar yozilgan. Yuklashdan oldin tekshiring:
> - Payme / Click ulanmagan bo‘lsa — matndan ularni olib tashlang (⟨Payme/Click⟩ belgisi bor joylar).
> - Yetkazib berish hududi (hozir “Toshkent”) haqiqiy hududlaringizga mos bo‘lsin.
> - Matnga sharh, reyting, “eng arzon”, “1 soatda yetkazamiz” kabi tasdiqlanmagan va’dalar qo‘shmang —
>   Google Play qoidalari va iste’molchilar huquqlari buni taqiqlaydi.

---

## 1. Fayllar

| Fayl | Play Console’da qayerga | O‘lcham |
|---|---|---|
| `play-icon-512.png` | Store listing → **App icon** | 512×512 PNG |
| `feature-graphic-uz.png` / `feature-graphic-ru.png` | Store listing → **Feature graphic** (har bir til uchun) | 1024×500 PNG |
| `screenshots/uz/*.png`, `screenshots/ru/*.png` | Store listing → **Phone screenshots** (2–8 ta) | 1080×1920 PNG |

Skrinshotlar **Git’ga qo‘shilmaydi**: ular saytning o‘zidan olinadi va hozir demo mahsulotlar va demo banneri ko‘rinadi.
Haqiqiy mahsulotlar qo‘shilib, demo banner o‘chirilgandan keyin qayta oling:

```bash
npx playwright install chromium        # bir martalik
node scripts/play-store-assets.mjs https://gulzor.uz
```
Skript feature graphic’larni ham qayta yasaydi (shriftlar saytdan olinadi).
Ikonka o‘zgarsa: `node scripts/generate-icons.mjs` (`play-icon-512.png` ham yangilanadi).

---

## 2. Do‘kon sahifasi matnlari

Play Console → **Grow users → Store presence → Main store listing**.
Asosiy til va qo‘shimcha tarjima **Manage translations** orqali qo‘shiladi.
Play Console’ning til ro‘yxatida o‘zbek tili bo‘lmasa, asosiy til sifatida rus tilini tanlang va o‘zbekcha matnni tavsif ichida qoldiring.

### O‘zbekcha

**App name** (≤ 30 belgi):
```
Gulzor — gul do‘koni
```

**Short description** (≤ 80 belgi):
```
Guldastalar va gullarni onlayn buyurtma qiling — kerakli sana va vaqtga.
```

**Full description** (≤ 4000 belgi):
```
Gulzor — Toshkentdagi onlayn gul do‘koni. Guldasta tanlang, uni o‘zingizga moslang va kerakli kun hamda vaqtga yetkazib berishni buyurtma qiling.

Nimalar bor:
• Katalog: atirgullar, lolalar, qutidagi va savatdagi gullar, uy o‘simliklari va sovg‘alar
• Qidiruv va filtrlar: gul turi, munosabat, narx va mavjudlik bo‘yicha
• Guldastani moslash: o‘lcham, gullar soni, rang, otkritka va sovg‘alar — narx darhol hisoblanadi
• Yetkazib berish yoki olib ketish: hudud, sana va vaqt oralig‘ini o‘zingiz tanlaysiz, yetkazish narxi oldindan ko‘rinadi
• Boshqa odamga sovg‘a: qabul qiluvchining ma’lumotlari, otkritka matni, xohlasangiz — anonim
• To‘lov: naqd pul ⟨Payme/Click⟩
• Buyurtma holatini kuzatish: buyurtma raqami va telefon orqali
• Maxsus guldasta: g‘oyangizni yozing yoki namuna rasm yuboring
• Shaxsiy kabinet (ixtiyoriy): buyurtmalar tarixi, saqlangan manzillar, sevimlilar, qayta buyurtma
• O‘zbek va rus tillarida

Hisob ochish shart emas — buyurtmani ro‘yxatdan o‘tmasdan ham berishingiz mumkin.
Hisobni istalgan vaqtda ilovaning o‘zida o‘chirishingiz mumkin.
```

### Русский

**App name** (≤ 30):
```
Gulzor — цветы и букеты
```

**Short description** (≤ 80):
```
Закажите букеты и цветы онлайн — с доставкой на удобные дату и время.
```

**Full description** (≤ 4000):
```
Gulzor — онлайн-магазин цветов в Ташкенте. Выберите букет, настройте его под себя и закажите доставку на нужный день и время.

Что есть в приложении:
• Каталог: розы, тюльпаны, цветы в коробке и в корзине, комнатные растения и подарки
• Поиск и фильтры: по виду цветов, поводу, цене и наличию
• Настройка букета: размер, количество цветов, цвет, открытка и подарки — цена считается сразу
• Доставка или самовывоз: вы сами выбираете район, дату и интервал времени, стоимость доставки видна заранее
• Подарок другому человеку: данные получателя, текст открытки, по желанию — анонимно
• Оплата: наличными ⟨Payme/Click⟩
• Отслеживание заказа по номеру заказа и телефону
• Индивидуальный букет: опишите идею или пришлите фото-пример
• Личный кабинет (по желанию): история заказов, сохранённые адреса, избранное, повтор заказа
• На узбекском и русском языках

Регистрация не обязательна — заказ можно оформить без аккаунта.
Аккаунт можно удалить в любой момент прямо в приложении.
```

**Category:** Shopping · **Tags:** Flowers, Gifts (Play taklif qilganlardan).
**Contact details:** do‘kon telefoni yoki email, sayt: `https://gulzor.uz`.

---

## 3. App content (Policy) bo‘limi javoblari

Play Console → **Policy and programs → App content**.

| Bo‘lim | Javob |
|---|---|
| **Privacy policy** | `https://gulzor.uz/maxfiylik` |
| **App access** | Hamma funksiyalar hisobsiz ishlaydi → “All functionality is available without special access”. (Kabinetni sinash uchun sharhlovchiga test hisobi bermoqchi bo‘lsangiz — telefon va parolni shu yerga yozing.) |
| **Ads** | No, my app does not contain ads |
| **Content rating** | Anketa: “Shopping / commerce”; zo‘ravonlik, qimor, foydalanuvchilar o‘zaro muloqoti — yo‘q. Mahsulotlar — gullar va sovg‘alar. |
| **Target audience** | 18+ (yoki 13+). 13 yoshdan kichiklar uchun **belgilamang** — TWA ilovalar bolalar dasturiga mos emas. |
| **News app** | No |
| **Government app** | No |
| **Financial features** | None (to‘lov Payme/Click sahifasida amalga oshadi) |
| **Health** | No |
| **Account deletion** | Ilovada hisob ochish mumkin → **Delete account URL:** `https://gulzor.uz/hisobni-ochirish` |

### Data safety

**Umumiy savollar:**
- Does your app collect or share any of the required user data types? → **Yes**
- Is all of the user data collected by your app encrypted in transit? → **Yes** (faqat HTTPS)
- Do you provide a way for users to request that their data is deleted? → **Yes**
  (hisob — `/hisobni-ochirish` sahifasida o‘zi; buyurtmalar — do‘konga murojaat orqali)

**Yig‘iladigan ma’lumotlar** (hammasi foydalanuvchi o‘zi kiritadi, reklama yoki kuzatuv uchun ishlatilmaydi,
uchinchi tomonga **sotilmaydi va berilmaydi**):

| Ma’lumot turi (Play nomi) | Nima | Majburiymi | Maqsad (Play nomi) |
|---|---|---|---|
| Personal info → **Name** | buyurtmachi va qabul qiluvchi ismi | Buyurtma uchun majburiy | App functionality, Account management |
| Personal info → **Phone number** | buyurtmachi va qabul qiluvchi telefoni | Buyurtma uchun majburiy | App functionality, Account management |
| Personal info → **Address** | yetkazib berish manzili | Yetkazib berishda majburiy (olib ketishda yo‘q) | App functionality |
| Financial info → **Purchase history** | buyurtmalar tarkibi va summasi | Majburiy | App functionality |
| Photos and videos → **Photos** | maxsus guldasta uchun namuna rasm | Ixtiyoriy | App functionality |
| App activity → **Other user-generated content** | otkritka matni, kuryerga izoh, maxsus so‘rov tavsifi | Ixtiyoriy | App functionality |

**Shared (uchinchi tomonga berish):** **No.**
Buyurtma xabari do‘kon egasining Telegram chatiga Telegram Bot API orqali yuboriladi va to‘lovda
Payme/Click’ga faqat buyurtma raqami va summasi uzatiladi — bu do‘kon nomidan ishlaydigan xizmat ko‘rsatuvchilar,
Play qoidalarida “sharing” hisoblanmaydi.

**Yig‘ilmaydi:** email, joylashuv (GPS), kontaktlar, qurilma identifikatorlari, reklama ID, analitika/crash SDK’lar.
Karta ma’lumotlari ilovada kiritilmaydi — to‘lov Payme/Click sahifasida bo‘ladi.

> Saytga yangi narsa qo‘shilsa (masalan, analitika, push-bildirishnoma, email yig‘ish),
> Data safety javoblarini va maxfiylik siyosatini ham yangilang.

---

## 4. Yuklashdan oldingi nazorat ro‘yxati

- [ ] `https://gulzor.uz/maxfiylik` va `https://gulzor.uz/hisobni-ochirish` ochiladi.
- [ ] Demo banner o‘chirilgan, demo mahsulotlar haqiqiylariga almashtirilgan.
- [ ] Skrinshotlar haqiqiy saytdan qayta olingan (`node scripts/play-store-assets.mjs https://gulzor.uz`).
- [ ] Matnlardagi ⟨Payme/Click⟩ va hudud nomi tekshirilgan.
- [ ] Ruscha matnlarni rus tilini yaxshi biladigan odam o‘qib chiqqan.
- [ ] `assetlinks.json` ga Google Play imzo kalitining barmoq izi qo‘shilgan (`docs/ANDROID-ILOVA.md`, 7-bo‘lim).
