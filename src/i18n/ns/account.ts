const uz = {
  title: "Shaxsiy kabinet",
  intro:
    "Hisob shart emas — buyurtmani ro‘yxatdan o‘tmasdan ham berishingiz mumkin. Hisob buyurtmalar tarixi, saqlangan manzillar va sevimlilar uchun qulay.",
  hello: "Salom, {name}!",
  logout: "Chiqish",
  orders: "Buyurtmalarim",
  noOrders: "Hali buyurtma yo‘q",
  toCatalog: "Katalogga o‘tish",
  orderLine: "{created} · yetkazish {date} · {status}",
  repeat: "Qayta buyurtma",
  addresses: "Saqlangan manzillar",
  noAddresses: "Buyurtma berishda “Manzilni hisobimda saqlash” belgisini qo‘ysangiz, manzil shu yerda paydo bo‘ladi.",
  remove: "O‘chirish",
  favoritesLink: "Sevimlilar ro‘yxati →",
  // Auth forms
  tabLogin: "Kirish",
  tabRegister: "Ro‘yxatdan o‘tish",
  phone: "Telefon raqami",
  password: "Parol",
  checking: "Tekshirilmoqda…",
  login: "Kirish",
  name: "Ismingiz",
  passwordHint: "Kamida 8 belgi",
  saving: "Saqlanmoqda…",
  register: "Hisob yaratish",
  // Favorites
  favorites: "Sevimlilar",
  favoritesEmpty: "Sevimlilar ro‘yxati bo‘sh",
  favoritesEmptyText: "Yoqqan guldastalarni yurakcha belgisi bilan saqlang — keyin bu yerdan tez topasiz.",
};

const ru: typeof uz = {
  title: "Личный кабинет",
  intro:
    "Аккаунт не обязателен — заказ можно оформить без регистрации. С аккаунтом удобно смотреть историю заказов, сохранённые адреса и избранное.",
  hello: "Здравствуйте, {name}!",
  logout: "Выйти",
  orders: "Мои заказы",
  noOrders: "Заказов пока нет",
  toCatalog: "Перейти в каталог",
  orderLine: "{created} · доставка {date} · {status}",
  repeat: "Повторить заказ",
  addresses: "Сохранённые адреса",
  noAddresses: "Отметьте «Сохранить адрес в аккаунте» при оформлении заказа — и адрес появится здесь.",
  remove: "Удалить",
  favoritesLink: "Избранное →",
  tabLogin: "Вход",
  tabRegister: "Регистрация",
  phone: "Номер телефона",
  password: "Пароль",
  checking: "Проверяем…",
  login: "Войти",
  name: "Ваше имя",
  passwordHint: "Не менее 8 символов",
  saving: "Сохраняем…",
  register: "Создать аккаунт",
  favorites: "Избранное",
  favoritesEmpty: "В избранном пока пусто",
  favoritesEmptyText: "Сохраняйте понравившиеся букеты сердечком — так их будет легко найти.",
};

const ns = { uz, ru };
export default ns;
