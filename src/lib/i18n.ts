import type { Locale } from '@/components/locale';

export const copy = {
  pl: {
    collection: 'Kolekcja świąteczna', all: 'Wszystkie', discover: 'Poznaj produkt', emptyTitle: 'Ups! Na razie nic tu nie ma.', emptyBody: 'Pracujemy nad nowymi produktami. Zajrzyj do nas ponownie!', otherCandles: 'Zobacz pozostałe świece',
    checkoutTitle: 'Podsumowanie', customerData: 'Dane zamówienia', firstName: 'Imię', lastName: 'Nazwisko', email: 'Adres e-mail', phone: 'Numer telefonu', street: 'Ulica i numer', postalCode: 'Kod pocztowy', city: 'Miasto', delivery: 'Metoda dostawy', payment: 'Metoda płatności', promo: 'Kod promocyjny', notes: 'Uwagi do zamówienia', cart: 'Twój koszyk', productsValue: 'Wartość produktów', createOrder: 'Przejdź do potwierdzenia', choose: 'Wybierz',
  },
  ru: {
    collection: 'Праздничная коллекция', all: 'Все', discover: 'Посмотреть товар', emptyTitle: 'Пока здесь ничего нет.', emptyBody: 'Мы работаем над новыми товарами. Загляните к нам снова!', otherCandles: 'Посмотреть остальные свечи',
    checkoutTitle: 'Оформление заказа', customerData: 'Данные заказа', firstName: 'Имя', lastName: 'Фамилия', email: 'Электронная почта', phone: 'Номер телефона', street: 'Улица и номер дома', postalCode: 'Почтовый индекс', city: 'Город', delivery: 'Способ доставки', payment: 'Способ оплаты', promo: 'Промокод', notes: 'Комментарий к заказу', cart: 'Ваша корзина', productsValue: 'Стоимость товаров', createOrder: 'Перейти к подтверждению', choose: 'Выберите',
  },
} as const;

export function t(locale: Locale) { return copy[locale]; }

const productRu: Record<string, { name: string; description: string; category: string }> = {
  'XMAS-TREE-001': { name: 'Декоративная свеча «Ёлка 3D»', description: 'Небольшая форма и большая праздничная атмосфера. Декоративная свеча в форме ёлки для особенных зимних мгновений.', category: 'Формовые свечи' },
  'XMAS-GINGER-001': { name: 'Пряничный человечек', description: 'Очаровательная праздничная деталь, вдохновлённая пряничным настроением и магией декабрьских вечеров.', category: 'Формовые свечи' },
  'XMAS-AMBER-180': { name: 'Winter Amber', description: 'Тепло, заключённое в янтарное стекло. Небольшой ритуал для долгих зимних вечеров.', category: 'Свечи в стекле' },
  'XMAS-MINI-120': { name: 'Winter Mini', description: 'Маленькая свеча — большое удовольствие. Идеальный подарок или особый зимний акцент в интерьере.', category: 'Свечи в стекле' },
};

export function localizedProduct(locale: Locale, product: { sku: string; name: string; description: string; category?: { name: string } | null }) {
  const ru = productRu[product.sku];
  return locale === 'ru' && ru ? { name: ru.name, description: ru.description, category: ru.category } : { name: product.name, description: product.description, category: product.category?.name ?? 'Kolekcja' };
}
