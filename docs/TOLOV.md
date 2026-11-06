# Payme va Click'ni ulash

Kod tayyor, lekin **haqiqiy merchant hisobisiz to'lov ishlamaydi**. Avtomatik testlar faqat simulyatsiya: ular
protokol mantig'ini tekshiradi, Payme va Click serverlari bilan ulanishni emas. Quyidagi sinovlardan o'tmaguncha
onlayn to'lovni mijozlar uchun yoqmang.

> Hozir faqat **Gulzor o'z do'koni** onlayn to'lov oladi. Boshqa floristlar naqd pul oladi, chunki onlayn pul
> Gulzor hisobiga tushadi va floristga o'tkazish uchun Payme/Click bilan alohida shartnoma kerak.

## Nima kerak

- Ro'yxatdan o'tgan yuridik shaxs yoki YaTT, bank hisobi.
- Haqiqiy domen va HTTPS.
- Payme va Click bilan merchant shartnomasi.

## 1. Payme

1. https://merchant.paycom.uz da kabinet oching, kassa yarating.
2. Kassa sozlamalarida:
   - endpoint: `https://<domen>/api/payments/payme`
   - hisob maydoni: `order_id`
3. Serverga (Render → Environment) yozing, kodga yozmang:
   ```
   PAYME_MERCHANT_ID=<kassa id>
   PAYME_KEY=<test kaliti>
   PAYME_CHECKOUT_URL=https://test.paycom.uz
   ```
4. https://test.paycom.uz sandbox'ida barcha ssenariylarni o'tkazing: avtorizatsiya xatosi, noto'g'ri summa,
   noto'g'ri buyurtma, yaratish, bajarish, bekor qilish.
5. Sandbox'dan o'tgach, ishchi kalitni qo'ying va `PAYME_CHECKOUT_URL=https://checkout.paycom.uz` deb o'zgartiring.

## 2. Click

1. https://merchant.click.uz da xizmat yarating.
2. Xizmat sozlamalarida:
   - Prepare URL: `https://<domen>/api/payments/click/prepare`
   - Complete URL: `https://<domen>/api/payments/click/complete`
3. Serverga yozing:
   ```
   CLICK_SERVICE_ID=
   CLICK_MERCHANT_ID=
   CLICK_SECRET_KEY=
   CLICK_MERCHANT_USER_ID=
   CLICK_TEST_MODE=1
   ```
4. Click test vositalari bilan prepare va complete so'rovlarini, imzo xatosini, noto'g'ri summani sinang.
5. Sinovdan o'tgach `CLICK_TEST_MODE` ni olib tashlang.

`CLICK_TEST_MODE=1` faqat mijozga "test rejimi" ogohlantirishini ko'rsatadi, to'lovning o'zini o'zgartirmaydi.

## 3. Yoqish

1. Admin → **Sozlamalar**: "Integratsiyalar holati" da provayder **Test rejimi** yoki **Ishchi rejim** ko'rinishi kerak.
2. "Payme'ni yoqish" / "Click'ni yoqish" belgisini qo'ying. Checkout'da usul faqat shunda va kalitlar bor bo'lsa chiqadi.
3. Haqiqiy kichik summa bilan bitta buyurtma bering va tekshiring:
   - Admin → **To'lovlar** da tranzaksiya "To'langan";
   - buyurtma sahifasi o'zi "To'langan" ga o'tdi;
   - Telegram'ga xabar keldi.
4. Shu buyurtmani bekor qilib, pul qaytarishni sinang.

## Tizim qanday ishlaydi

- Buyurtma **faqat provayder serveridan kelgan tasdiqlangan so'rov** bilan to'langan bo'ladi. Brauzerdan kelgan
  ma'lumotga ishonilmaydi. Payme so'rovi Basic auth, Click so'rovi MD5 imzo bilan tekshiriladi.
- Summa har doim serverdagi buyurtma summasi bilan solishtiriladi.
- Takroriy yoki bir vaqtdagi callback buyurtmani faqat bir marta to'langan qiladi (`settlePayment`).
- Bekor qilingan buyurtma to'lanmaydi.
- To'lov o'tmasa yoki bekor qilinsa, mijoz buyurtma sahifasidan qayta urinadi.

## Pul qaytarish

To'langan buyurtma bekor qilinsa, to'lov holati **"Pul qaytarilishi kerak"** bo'ladi va Admin → To'lovlar'da ogohlantirish chiqadi.

- **Payme:** pulni Payme kabinetida qaytaring. Payme `CancelTransaction` yuboradi va holat o'zi "Pul qaytarildi" bo'ladi.
- **Click:** pulni Click kabinetida qaytaring, keyin buyurtma sahifasida "Pul qaytarildi deb belgilash" tugmasini bosing.

Sayt pulni o'zi qaytarmaydi.

## Yangi provayder qo'shish

1. `src/lib/payments/<nomi>.ts`: callback'larni tekshirish, to'lovni `settlePayment()` orqali qayd etish.
2. `src/lib/payments/providers.ts`: `PROVIDERS` ga qo'shish.
3. `/api/payments/<nomi>` route va `payment_method` enum'iga qiymat.
