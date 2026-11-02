const uz = {
  title: "Yetkazib berish va to‘lov",
  intro: "Biz faqat quyida ko‘rsatilgan hududlarga yetkazib beramiz. Yetkazib berish narxi va mavjud vaqtlar buyurtmani tasdiqlashdan oldin aniq ko‘rsatiladi.",
  zones: "Hududlar va narxlar",
  none: "Yetkazib berish hududlari hali sozlanmagan.",
  colZone: "Hudud",
  colFee: "Narx",
  colFree: "Bepul",
  colMin: "Minimal buyurtma",
  colSameDay: "Shu kuni",
  freeFrom: "{amount}dan",
  sameDayUntil: "Ha, soat {time} gacha buyurtma",
  no: "Yo‘q",
  sameDayNote:
    "Shu kuni yetkazib berish buyurtma vaqti, guldastani tayyorlash muddati va bo‘sh vaqt oraliqlariga bog‘liq. Mavjud bo‘lmasa, rasmiylashtirishda bu vaqtlar tanlab bo‘lmaydigan bo‘ladi.",
  slots: "Vaqt oraliqlari",
  pickup: "Olib ketish",
  pickupText: "Buyurtmani bepul olib ketishingiz mumkin: {address}.",
  pickupSoon: "manzil tez orada ko‘rsatiladi",
  payment: "To‘lov usullari",
  noPayments: "To‘lov usullari hali sozlanmagan.",
  marketplacePayment:
    "Yuqoridagi usullar Gulzor do‘koni buyurtmalari uchun. Boshqa do‘konlar buyurtmani o‘zi yetkazadi va to‘lovni yetkazib berishda naqd oladi; ularning hududlari va narxlari do‘kon sahifasida.",
  otherTitle: "Hududingiz ro‘yxatda yo‘qmi?",
  otherText: "Boshqa shahar yoki tumanga yetkazib berish imkoniyatini alohida aniqlab beramiz.",
  telegram: "Telegram orqali yozish",
  request: "So‘rov qoldirish",
};

const ru: typeof uz = {
  title: "Доставка и оплата",
  intro: "Мы доставляем только в перечисленные ниже районы. Стоимость доставки и доступное время показываются до подтверждения заказа.",
  zones: "Зоны и стоимость",
  none: "Зоны доставки ещё не настроены.",
  colZone: "Зона",
  colFee: "Стоимость",
  colFree: "Бесплатно",
  colMin: "Минимальный заказ",
  colSameDay: "В день заказа",
  freeFrom: "от {amount}",
  sameDayUntil: "Да, при заказе до {time}",
  no: "Нет",
  sameDayNote:
    "Доставка в день заказа зависит от времени заказа, срока сборки букета и свободных интервалов. Если она невозможна, такие интервалы будут недоступны при оформлении.",
  slots: "Интервалы доставки",
  pickup: "Самовывоз",
  pickupText: "Заказ можно забрать бесплатно: {address}.",
  pickupSoon: "адрес скоро появится",
  payment: "Способы оплаты",
  noPayments: "Способы оплаты ещё не настроены.",
  marketplacePayment:
    "Эти способы — для заказов магазина Gulzor. Другие магазины доставляют заказы сами и принимают оплату наличными при доставке; их зоны и цены — на странице магазина.",
  otherTitle: "Вашего района нет в списке?",
  otherText: "Мы отдельно уточним возможность доставки в другой город или район.",
  telegram: "Написать в Telegram",
  request: "Оставить заявку",
};

const en: typeof uz = {
  title: "Delivery and payment",
  intro: "We deliver only to the areas listed below. The delivery fee and available times are shown before you confirm the order.",
  zones: "Areas and prices",
  none: "Delivery areas have not been set up yet.",
  colZone: "Area",
  colFee: "Fee",
  colFree: "Free",
  colMin: "Minimum order",
  colSameDay: "Same day",
  freeFrom: "from {amount}",
  sameDayUntil: "Yes, order by {time}",
  no: "No",
  sameDayNote:
    "Same-day delivery depends on the order time, the preparation time of the bouquet and free time slots. When it is not possible, those slots cannot be selected at checkout.",
  slots: "Time slots",
  pickup: "Pickup",
  pickupText: "You can pick up your order free of charge: {address}.",
  pickupSoon: "the address will be published soon",
  payment: "Payment methods",
  noPayments: "Payment methods have not been set up yet.",
  marketplacePayment:
    "The methods above apply to orders from the Gulzor shop. Other shops deliver their orders themselves and take cash on delivery; their areas and prices are on the shop page.",
  otherTitle: "Your area is not listed?",
  otherText: "We will check separately whether delivery to another city or district is possible.",
  telegram: "Message us on Telegram",
  request: "Send a request",
};

const ns = { uz, ru, en };
export default ns;
