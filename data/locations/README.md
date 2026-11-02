# O‘zbekiston joylashuvlari (`uz-soato.json`)

14 ta hudud (Qoraqalpog‘iston Respublikasi, 12 viloyat, Toshkent shahri), 205 ta tuman / shahar va 9 471 ta mahalla,
SOATO kodlari va mahalla markaz nuqtalari bilan.

- **Manba:** [pdlpad/SOATO](https://github.com/pdlpad/SOATO), commit `57b7cf0b79360e37fc6e34567146b7955b1263f9` (2026-10-16).
- **Litsenziya:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — manbani ko‘rsatish sharti bilan tijoriy foydalanish
  mumkin. Atribusiya admin paneldagi “Joylashuvlar” sahifasida va shu faylda.
- Nomlar manbadagidek (o‘zbek / qoraqalpoq kirill yozuvida). Lotincha nomlar import paytida avtomatik o‘giriladi
  (`src/lib/translit.ts`), hududlarning to‘liq rasmiy nomlari (4 tilda) `src/lib/locations.ts` dagi `REGION_NAMES` da.
- Tumanning nuqtasi — uning mahallalari nuqtalarining o‘rtachasi.
- Manbada aholi punktlari (qishloqlar) alohida yo‘q — ularni admin panelda qo‘shish mumkin.

## Manbaga kiritilgan tuzatishlar

| SOATO | Manbada | Faylda |
|---|---|---|
| 1714401+1714212 | Наманган шаҳри; Наманган тумани | Наманган шаҳри / Наманган тумани (manbada ikkalasining mahallalari birga berilgan) |
| 1718406 | Каттақўрғон шаҳар | Каттақўрғон шаҳри |
| 1727424 | Янгийўлшаҳри | Янгийўл шаҳри |
| 1726277 | Шайхонтохур тумани | Шайхонтоҳур тумани |

Bundan tashqari kirill so‘zlar ichidagi lotin harflari (masalan “Aндижон” dagi lotin A) kirillga almashtirilgan,
mahalla nomidagi «» qo‘shtirnoqlar olib tashlangan.

## Yangilash

```bash
git clone --depth 1 https://github.com/pdlpad/SOATO /tmp/soato
SOURCE_COMMIT=<commit> node scripts/locations-build.mjs /tmp/soato data/locations/uz-soato.json
```

Bazaga: `npm run db:migrate` bo‘sh jadvalga avtomatik yuklaydi. To‘ldirilgan bazaga faqat yangi kodlar qo‘shiladi
(`importLocations`), admin tahrirlagan nomlar o‘zgarmaydi.
