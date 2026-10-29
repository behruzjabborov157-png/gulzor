const uz = {
  priceFrom: "{price}dan",
  oldPrice: "Avvalgi narx {price}",
  photoSoon: "Rasm tez orada",
  seeAll: "Barchasini ko‘rish",
  breadcrumbs: "Navigatsiya",
  home: "Bosh sahifa",
  catalog: "Katalog",
  loading: "Yuklanmoqda…",
  close: "Yopish",
  pieces: "{n} dona",
  stock: {
    available: "Mavjud",
    made_to_order: "Buyurtma asosida",
    out_of_stock: "Hozircha mavjud emas",
    out_of_season: "Mavsumda emas",
  },
  badge: { new: "Yangi", premium: "Premium", madeToOrder: "Buyurtma asosida", sale: "Chegirma" },
  demoProduct: "Namuna mahsulot",
  favoriteAdd: "{name} — sevimlilarga qo‘shish",
  favoriteRemove: "{name} — sevimlilardan olib tashlash",
  error: {
    title: "Nimadir noto‘g‘ri ketdi",
    text: "Sahifani yuklashda xatolik yuz berdi. Qayta urinib ko‘ring — muammo davom etsa, birozdan so‘ng qayting.",
    code: "Xato kodi: {code}",
    retry: "Qayta urinish",
  },
  notFound: {
    title: "Sahifa topilmadi",
    text: "Ehtimol, havola eskirgan yoki mahsulot sotuvdan olingan. Katalogdan boshqa guldastalarni ko‘ring.",
  },
  credits: {
    title: "Rasm mualliflari",
    intro:
      "Bosh sahifa va bo‘limlardagi bezak fotosuratlari Unsplash’dan Unsplash litsenziyasi asosida olingan; ular kayfiyat uchun, sotiladigan mahsulot sifatida ko‘rsatilmaydi. Namuna katalogdagi fotosuratlar Wikimedia Commons’dan erkin litsenziyalar (CC0, ommaviy mulk, CC BY, CC BY-SA) asosida olingan va saytga moslash uchun qirqilgan/siqilgan. Ular haqiqiy mahsulot fotosuratlari emas. Do‘kon o‘z mahsulotlari rasmlarini yuklaganda ushbu rasmlar almashtiriladi.",
    author: "Muallif: {author} · Litsenziya: {license}",
    unknown: "noma’lum",
  },
};

const ru: typeof uz = {
  priceFrom: "от {price}",
  oldPrice: "Прежняя цена {price}",
  photoSoon: "Фото скоро появится",
  seeAll: "Смотреть все",
  breadcrumbs: "Навигация",
  home: "Главная",
  catalog: "Каталог",
  loading: "Загрузка…",
  close: "Закрыть",
  pieces: "{n} шт.",
  stock: {
    available: "В наличии",
    made_to_order: "Под заказ",
    out_of_stock: "Нет в наличии",
    out_of_season: "Не сезон",
  },
  badge: { new: "Новинка", premium: "Премиум", madeToOrder: "Под заказ", sale: "Скидка" },
  demoProduct: "Демо-товар",
  favoriteAdd: "{name} — добавить в избранное",
  favoriteRemove: "{name} — убрать из избранного",
  error: {
    title: "Что-то пошло не так",
    text: "Не удалось загрузить страницу. Попробуйте ещё раз — если ошибка повторится, зайдите чуть позже.",
    code: "Код ошибки: {code}",
    retry: "Попробовать снова",
  },
  notFound: {
    title: "Страница не найдена",
    text: "Возможно, ссылка устарела или товар снят с продажи. Посмотрите другие букеты в каталоге.",
  },
  credits: {
    title: "Авторы фотографий",
    intro:
      "Оформительские фотографии на главной и в разделах взяты с Unsplash по лицензии Unsplash; они создают настроение и не выдаются за продаваемые товары. Фотографии демо-каталога взяты с Wikimedia Commons по свободным лицензиям (CC0, общественное достояние, CC BY, CC BY-SA) и обрезаны/сжаты для сайта. Это не фотографии реальных товаров. Когда магазин загрузит свои фото, эти изображения будут заменены.",
    author: "Автор: {author} · Лицензия: {license}",
    unknown: "неизвестен",
  },
};

const ns = { uz, ru };
export default ns;
