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
