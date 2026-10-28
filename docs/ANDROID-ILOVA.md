# Gulzor — telefon ilovasi (PWA) va Android APK (Bubblewrap / TWA)

Bu qo‘llanma ikki narsani tushuntiradi:

1. **PWA** — sayt telefon ekraniga ilova sifatida qo‘shiladi. Bu allaqachon tayyor, faqat sayt HTTPS’da ishlashi kerak.
2. **Android ilova (APK/AAB)** — o‘sha saytning o‘zi Google Play’ga chiqariladigan ilova ko‘rinishida.
   Bubblewrap dasturi bilan, domen tayyor bo‘lgandan keyin yasaladi.

Android ilova — saytning o‘zi, faqat brauzer manzil satrisiz ochiladi (Trusted Web Activity, TWA).
Shuning uchun saytdagi har bir o‘zgarish (narx, mahsulot, dizayn) ilovada ham **darhol** ko‘rinadi —
ilovani qayta yuklash shart emas.

---

## 1-qism. PWA — "Bosh ekranga qo‘shish"

### Nima tayyor
| Narsa | Qayerda |
|---|---|
| Manifest (nom, ranglar, ikonkalar, tezkor havolalar: Katalog, Savat, Buyurtmani kuzatish) | `src/app/manifest.ts` → `https://gulzor.uz/manifest.webmanifest` |
| Ikonkalar (192, 512, maskable 512, Apple 180, favicon) | `public/icons/`, `src/app/icon.png` |
| Service worker | `public/sw.js` |
| Offline sahifa (o‘zbekcha + ruscha) | `public/offline.html` |
| "Ilovani o‘rnatish" tugmasi (sayt pastki qismida, footer’da) | `src/components/pwa.tsx` |

### Service worker nima qiladi (va nima qilmaydi)
- Sahifalar **har doim internetdan** olinadi — narx, qoldiq va buyurtma holati eskirmasligi uchun.
- Internet yo‘q bo‘lsa, brauzer xatosi o‘rniga chiroyli **offline sahifa** chiqadi ("Qayta urinish" tugmasi bilan).
- Faqat o‘zgarmaydigan fayllar keshlanadi: sayt kodi (`/_next/static`), ikonkalar va katalog rasmlari (ko‘pi bilan 120 ta).
- **Hech qachon** keshlanmaydi: admin panel, `/api` (to‘lov tizimlari), `/media` (mijoz yuklagan rasmlar), formalar.
- Savat brauzerning o‘zida saqlanadi, shuning uchun internet uzilsa ham yo‘qolmaydi.
- Service worker faqat production build’da (`npm run build && npm start`) ishlaydi, `npm run dev`da o‘chiq.

### Mijoz qanday o‘rnatadi
- **Android (Chrome):** sayt pastidagi **"Ilovani o‘rnatish"** tugmasi yoki Chrome menyusi (⋮) → **"Ilovani o‘rnatish" / "Bosh ekranga qo‘shish"**.
  Tugma faqat Chrome o‘rnatishga ruxsat berganda ko‘rinadi (HTTPS, manifest va service worker bo‘lganda).
- **iPhone/iPad (Safari):** tugma bosilganda yo‘riqnoma chiqadi: **Ulashish** (□↑) → **"На экран «Домой»" / "Add to Home Screen"**.
- **Kompyuter (Chrome/Edge):** manzil satridagi o‘rnatish belgisi.

### Ishga tushirgandan keyin tekshirish
1. Telefonda Chrome’da `https://gulzor.uz` ni oching → pastda "Ilovani o‘rnatish" → o‘rnating.
   Ekranda gul belgili **Gulzor** ikonkasi paydo bo‘lishi va ilova manzil satrisiz ochilishi kerak.
2. Kompyuterda Chrome → F12 → **Application** → **Manifest**: xato bo‘lmasligi kerak;
   **Service workers**: `sw.js` — *activated and is running*.
3. O‘sha yerda **Network → Offline** belgilang va sahifani yangilang → offline sahifa chiqishi kerak.

### Ikonkani o‘z logotipingizga almashtirish
`scripts/generate-icons.mjs` ichidagi SVG’ni o‘z logotipingiz bilan almashtiring va ishga tushiring:
```bash
node scripts/generate-icons.mjs
```
Maskable ikonkada logotip markazdagi 80% doiradan chiqmasin (Android chetini kesadi).
Ikonka o‘zgarsa, `public/sw.js` dagi `VERSION` ni oshiring (masalan `gulzor-v2`) — eski kesh tozalanadi.

---

## 2-qism. Android ilova (APK / Google Play) — Bubblewrap bilan

### Oldindan kerak
- [ ] Sayt **haqiqiy domenda HTTPS bilan** ishlayapti (masalan `https://gulzor.uz`) — `docs/ISHGA-TUSHIRISH.md` bo‘yicha.
- [ ] `https://gulzor.uz/manifest.webmanifest` brauzerda ochiladi.
- [ ] Kompyuter (Windows, macOS yoki Linux) va **Node.js 20+**.
- [ ] Taxminan **3 GB** bo‘sh joy (Bubblewrap Java (JDK 17) va Android SDK’ni o‘zi yuklab oladi).
- [ ] Google Play’ga chiqarish uchun: **Google Play Console** hisobi (bir martalik 25 $ to‘lov).

### 1. Bubblewrap’ni o‘rnatish
```bash
npm install -g @bubblewrap/cli
```

### 2. Android loyihasini yaratish
Loyihani **sayt repozitoriysidan tashqarida**, alohida papkada yarating (u yerda maxfiy kalit saqlanadi):
```bash
mkdir gulzor-android
cd gulzor-android
bubblewrap init --manifest https://gulzor.uz/manifest.webmanifest
```
Birinchi marta so‘raydi:
- *Do you want Bubblewrap to install the JDK?* → **Yes**
- *Do you want Bubblewrap to install the Android SDK?* → **Yes**, keyin shartlarga → **Yes**

So‘ng ilova haqida savollar beradi. Ko‘p javoblar manifestdan **avtomatik to‘ldirilgan** — Enter bosish kifoya.
Quyidagilarga e’tibor bering:

| Savol | Javob |
|---|---|
| Domain | `gulzor.uz` (avtomatik) |
| URL path | `/` |
| Application name | `Gulzor — gul do‘koni` (Play’da ko‘rinadigan nom) |
| Short name | `Gulzor` (telefon ekranidagi nom) |
| **Application ID** | **`uz.gulzor.app`** — keyin o‘zgartirib bo‘lmaydi! |
| Starting version code | `1` |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar color | `#2E4A3B` |
| Splash screen color | `#FBF8F3` |
| Icon URL / Maskable icon URL | avtomatik (`/icons/icon-512.png`, `/icons/maskable-512.png`) |
| Monochrome icon URL | bo‘sh qoldiring (Enter) |
| Include app shortcuts? | **Yes** (Katalog, Savat, Buyurtmani kuzatish) |
| Include support for Play Billing? | **No** |
| Request geolocation permission? | **No** |
| Key store location | `./android.keystore` (standart) |
| Key name | `android` (standart) |
| Do you want to create one now? | **Yes** → ism, tashkilot, davlat kodi `UZ`, ikki marta parol |

Keyin yaratilgan `twa-manifest.json` faylida ikki qatorni o‘zgartiring:
```json
"navigationColor": "#2E4A3B",
"enableNotifications": false,
```
(Sayt hozir push-bildirishnoma yubormaydi, shuning uchun ruxsat so‘rash shart emas.)

### 3. ⚠️ Kalitni saqlab qo‘ying
`android.keystore` fayli va uning **ikki paroli** — ilovaning "pasporti".
Yo‘qolsa, Google Play’dagi ilovani **yangilab bo‘lmaydi**.
- Faylni va parollarni kamida ikki joyda saqlang (masalan, shifrlangan fleshka + parol menejeri).
- Bu faylni **hech qachon** GitHub’ga yuklamang, hech kimga yubormang.

### 4. APK va AAB yasash
```bash
bubblewrap build
```
Parollarni so‘raydi. *There are changes in twa-manifest.json…* deb so‘rasa → **Yes**.
Natijada papkada paydo bo‘ladi:
- `app-release-signed.apk` — telefonga to‘g‘ridan-to‘g‘ri o‘rnatib sinash uchun;
- `app-release-bundle.aab` — Google Play’ga yuklash uchun.

### 5. Saytga ilovani "tanitish" (Digital Asset Links)
Busiz ilova ochilganda tepada **brauzer manzil satri** ko‘rinib turadi.
Sayt ilovani tanishi uchun kalitning **SHA-256 barmoq izi** kerak.

**a) Barmoq izini olish.** Bubblewrap o‘rnatgan Java’ning `keytool` dasturi bilan
(`~/.bubblewrap/config.json` faylidagi `jdkPath` — Java papkasi):
```bash
# macOS / Linux
"$(node -p "require(require('os').homedir()+'/.bubblewrap/config.json').jdkPath")/bin/keytool" \
  -list -v -keystore android.keystore -alias android
```
```powershell
# Windows PowerShell
$jdk = (Get-Content "$env:USERPROFILE\.bubblewrap\config.json" | ConvertFrom-Json).jdkPath
& "$jdk\bin\keytool.exe" -list -v -keystore android.keystore -alias android
```
Chiqqan matndagi **`SHA256:`** qatorini nusxalang (`AB:CD:…` ko‘rinishida, 32 juft).

**b) Serverga yozish.** Serverdagi `/opt/gulzor/.env` fayliga qo‘shing:
```bash
TWA_PACKAGE_NAME=uz.gulzor.app
TWA_SHA256_FINGERPRINTS=AB:CD:...:EF
```
va saytni qayta ishga tushiring: `sudo systemctl restart gulzor`.

**c) Tekshirish.** `https://gulzor.uz/.well-known/assetlinks.json` ochilib, ichida paket nomi va
barmoq izi ko‘rinishi kerak. (Sozlanmaguncha bu manzil 404 qaytaradi — bu normal.)
Google’ning tekshiruvi:
`https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://gulzor.uz&relation=delegate_permission/common.handle_all_urls`

### 6. Telefonda sinash
APK faylini telefonga o‘tkazing (Telegram "Saqlangan xabarlar", USB yoki Google Drive orqali) va oching.
Telefon "noma’lum manbadan o‘rnatish"ga ruxsat so‘raydi — bir martalik ruxsat bering.
Kompyuterda Android SDK bo‘lsa: `bubblewrap install`.

Tekshiring:
- [ ] Ilova gul ikonkasi bilan **Gulzor** nomida o‘rnatildi.
- [ ] Ochilganda **manzil satri yo‘q** (bo‘lsa — 5-bosqichni tekshiring; o‘zgarish telefonga yetib borishi uchun ilovani o‘chirib, qayta o‘rnating).
- [ ] Ikonkani bosib turganda Katalog / Savat / Buyurtmani kuzatish tezkor havolalari bor.
- [ ] Buyurtma berish, to‘lov sahifasiga o‘tish va orqaga qaytish ishlaydi.
- [ ] Internetni o‘chirib ochganda offline sahifa chiqadi.

### 7. Google Play’ga chiqarish
1. Play Console → **Create app** → nom `Gulzor`, til, "App", "Free".
2. **Release → Production (yoki avval Internal testing) → Create new release** → `app-release-bundle.aab` ni yuklang.
   Google taklif qilgan **Play App Signing** ni qabul qiling.
3. ⚠️ **Muhim:** Play App Signing yoqilgach, Google ilovani **o‘z kaliti** bilan qayta imzolaydi.
   Play Console → **Test and release → App integrity → App signing** sahifasidan
   **"App signing key certificate" SHA-256** ni oling va serverdagi o‘zgaruvchiga **vergul bilan qo‘shing**:
   ```bash
   TWA_SHA256_FINGERPRINTS=AB:CD:...:EF,12:34:...:56
   ```
   (birinchisi — sizning yuklash kalitingiz, ikkinchisi — Google’niki), so‘ng `sudo systemctl restart gulzor`.
   Busiz Play’dan o‘rnatilgan ilovada manzil satri ko‘rinadi.
4. Do‘kon sahifasi, ikonka, banner, skrinshotlar, **Data safety**, **Content rating**, **Target audience**
   va **hisobni o‘chirish havolasi** — hammasi tayyor: **`docs/play-store/README.md`**.
5. **Maxfiylik siyosati:** `https://gulzor.uz/maxfiylik` · **Hisobni o‘chirish:** `https://gulzor.uz/hisobni-ochirish`.
6. Yangi shaxsiy dasturchi hisoblari uchun Google ishlab chiqarishga chiqarishdan oldin
   **yopiq test** (bir necha testerlar bilan ma’lum muddat) talab qilishi mumkin — Play Console ko‘rsatmalariga amal qiling.

### 8. Ilovani yangilash
Oddiy o‘zgarishlar (mahsulot, narx, dizayn, matn) uchun **ilovani qayta yuklash shart emas** — sayt yangilansa, ilova ham yangilanadi.
Ilovaning o‘zini (ikonka, nom, ranglar, tezkor havolalar) o‘zgartirish kerak bo‘lsa:
```bash
cd gulzor-android
bubblewrap update      # manifestdan yangi ma’lumotlarni oladi va versiya raqamini oshiradi
bubblewrap build
```
va yangi `app-release-bundle.aab` ni Play Console’ga yuklang.

### Muammolar
| Belgi | Sabab va yechim |
|---|---|
| Ilovada tepada manzil satri bor | `assetlinks.json` noto‘g‘ri yoki yo‘q. 5-bosqich; Play’dan o‘rnatilgan bo‘lsa — 7.3. Telefonda ilovani o‘chirib, qayta o‘rnating. |
| `bubblewrap init` manifestni o‘qiy olmadi | Sayt HTTPS’da ochilishini va `https://gulzor.uz/manifest.webmanifest` ishlashini tekshiring. |
| `assetlinks.json` 404 | `.env` da `TWA_PACKAGE_NAME` va `TWA_SHA256_FINGERPRINTS` yo‘q yoki noto‘g‘ri formatda (32 juft, `:` bilan). Serverni qayta ishga tushiring. |
| "Ilovani o‘rnatish" tugmasi ko‘rinmaydi | Ilova allaqachon o‘rnatilgan, sayt HTTPS’da emas yoki brauzer Chrome/Safari emas. |
