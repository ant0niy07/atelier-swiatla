'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { formatPrice } from '@/data/products';
import { useCart } from '@/stores/cart-store';
import { useLocale } from '@/components/locale';
import { localizedProduct, t } from '@/lib/i18n';

const fields = [
  ['firstName', 'Imię'], ['lastName', 'Nazwisko'], ['email', 'Adres e-mail'], ['phone', 'Numer telefonu'],
  ['street', 'Ulica i numer'], ['postalCode', 'Kod pocztowy'], ['city', 'Miasto'],
] as const;

type DeliveryMethod = {
  id: string; label: string; kind: string; rate_grosz: number; minimum_order_grosz: number | null;
  supports_blik_before_dispatch: boolean; supports_cod: boolean;
};
type Confirmation = {
  orderNumber: number; totalGrosz: number; paymentMethod: 'blik_before_dispatch' | 'cod' | 'pay_on_local_delivery';
  paymentStatus: string; blikRecipientPhone?: string;
};

function BlikConfirmation({ confirmation, locale }: { confirmation: Confirmation; locale: 'pl' | 'ru' }) {
  const ru = locale === 'ru';
  const title = `Świeczka — zamówienie nr ${confirmation.orderNumber}`;
  return <section className="checkout-confirmation" aria-live="polite">
    <span className="eyebrow">{ru ? 'ЗАКАЗ СОЗДАН' : 'ZAMÓWIENIE UTWORZONE'}</span>
    <h1 className="serif">{ru ? `Заказ № ${confirmation.orderNumber}` : `Zamówienie nr ${confirmation.orderNumber}`}</h1>
    <p>{ru ? 'Заказ сохранён и ожидает ручного подтверждения оплаты.' : 'Zamówienie zostało zapisane i oczekuje na ręczne potwierdzenie płatności.'}</p>
    <div className="summary">
      <p className="checkout-total"><span>{ru ? 'К оплате' : 'Do zapłaty'}</span><strong>{formatPrice(confirmation.totalGrosz)}</strong></p>
      <h2 className="serif">{ru ? 'Перевод на телефон BLIK' : 'Przelew na telefon BLIK'}</h2>
      <p><strong>{ru ? 'Получатель:' : 'Odbiorca:'}</strong> {confirmation.blikRecipientPhone}</p>
      <p><strong>{ru ? 'Сумма:' : 'Kwota:'}</strong> {formatPrice(confirmation.totalGrosz)}</p>
      <p><strong>{ru ? 'Название перевода:' : 'Tytuł przelewu:'}</strong> {title}</p>
      <p>{ru ? 'Откройте своё банковское приложение, выберите «Перевод BLIK на телефон», введите номер получателя, сумму и название перевода, затем завершите операцию в приложении банка.' : 'Otwórz własną aplikację bankową, wybierz „Przelew na telefon BLIK”, wpisz numer odbiorcy, kwotę i tytuł przelewu, a następnie dokończ przelew w aplikacji bankowej.'}</p>
      <p className="muted">{ru ? 'Сайт не запрашивает и не принимает одноразовый шестизначный код BLIK. Оплата не будет подтверждена автоматически.' : 'Strona nie prosi o jednorazowy sześciocyfrowy kod BLIK i go nie przyjmuje. Płatność nie zostanie potwierdzona automatycznie.'}</p>
    </div>
  </section>;
}

export default function Checkout() {
  const { locale } = useLocale();
  const text = t(locale);
  const items = useCart((state) => state.items);
  const clear = useCart((state) => state.clear);
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);
  const [acceptingOrders, setAcceptingOrders] = useState(true);
  const [blikAvailable, setBlikAvailable] = useState(false);
  const [deliveryMethodId, setDeliveryMethodId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutAttempt, setCheckoutAttempt] = useState<{ key: string; fingerprint: string } | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promo, setPromo] = useState<{ discountGrosz: number; shippingGrosz: number; totalGrosz: number; code: string; fingerprint: string } | null>(null);
  const [promoMessage, setPromoMessage] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const previewRequest = useRef(0);
  const lines = useMemo(() => items, [items]);
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.price_grosz, 0);
  const orderFingerprint = `${deliveryMethodId}:${paymentMethod}:${lines.map((line) => `${line.sku}:${line.variantId ?? ''}:${line.quantity}`).sort().join('|')}`;
  const selectedDelivery = deliveryMethods.find((method) => method.id === deliveryMethodId);
  const ru = locale === 'ru';

  useEffect(() => {
    fetch('/api/checkout')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        setDeliveryMethods(data.deliveryMethods ?? []);
        setAcceptingOrders(data.acceptingOrders !== false);
        setBlikAvailable(Boolean(data.blikAvailable));
      })
      .catch(() => setStatus(t(locale).deliveryError));
  }, [locale, text.deliveryError]);

  function invalidatePromo() {
    previewRequest.current += 1;
    setPromo(null);
    setPromoMessage('');
  }

  async function applyPromo() {
    if (!promoCode.trim() || !deliveryMethodId) {
      setPromoMessage(ru ? 'Сначала выберите доставку и введите код.' : 'Najpierw wybierz dostawę i wpisz kod.');
      return;
    }
    const requestId = ++previewRequest.current;
    setPromoMessage(ru ? 'Проверка кода…' : 'Sprawdzanie kodu…');
    try {
      const response = await fetch('/api/promo-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode, deliveryMethodId, items: lines.map((item) => ({ sku: item.sku, quantity: item.quantity })) }),
      });
      const data = await response.json().catch(() => ({}));
      if (requestId !== previewRequest.current) return;
      if (response.ok) {
        setPromo({ ...data, fingerprint: orderFingerprint });
        setPromoMessage(ru ? 'Промокод применён.' : 'Kod rabatowy został zastosowany.');
      } else if (data.error === 'DELIVERY_MINIMUM_NOT_MET') {
        setPromoMessage(ru ? 'Не достигнута минимальная сумма для выбранной доставки.' : 'Nie osiągnięto minimalnej kwoty dla wybranej dostawy.');
      } else {
        setPromoMessage(ru ? 'Промокод недействителен или условия не выполнены.' : 'Kod rabatowy jest nieważny lub warunki nie są spełnione.');
      }
    } catch {
      if (requestId === previewRequest.current) {
        setPromo(null);
        setPromoMessage(ru ? 'Не удалось проверить код. Попробуйте снова.' : 'Nie udało się sprawdzić kodu. Spróbuj ponownie.');
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!acceptingOrders) { setStatus(ru ? 'Приём заказов временно приостановлен.' : 'Przyjmowanie zamówień jest chwilowo wstrzymane.'); return; }
    if (!selectedDelivery || !paymentMethod || lines.length === 0) { setStatus(text.selectDelivery); return; }
    if (selectedDelivery.minimum_order_grosz !== null && subtotal < selectedDelivery.minimum_order_grosz) { setStatus(ru ? 'Не достигнута минимальная сумма для выбранной доставки.' : 'Nie osiągnięto minimalnej kwoty dla wybranej dostawy.'); return; }
    const draft = {
      deliveryMethodId, paymentMethod, promoCode: String(form.get('promotion') || ''), note: String(form.get('note') || ''), lockerCode: String(form.get('lockerCode') || ''),
      customer: Object.fromEntries(fields.map(([name]) => [name, String(form.get(name) || '')])),
      items: lines.map((item) => ({ sku: item.sku, variantId: item.variantId, quantity: item.quantity })),
    };
    const fingerprint = JSON.stringify(draft);
    const key = checkoutAttempt?.fingerprint === fingerprint ? checkoutAttempt.key : crypto.randomUUID();
    if (checkoutAttempt?.fingerprint !== fingerprint) setCheckoutAttempt({ key, fingerprint });
    setSubmitting(true);
    setStatus(text.creating);
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: key, ...draft }) });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.orderNumber) {
        clear();
        setCheckoutAttempt(null);
        setConfirmation(data as Confirmation);
        return;
      }
      const errors: Record<string, string> = {
        DELIVERY_MINIMUM_NOT_MET: ru ? 'Не достигнута минимальная сумма для выбранной доставки.' : 'Nie osiągnięto minimalnej kwoty dla wybranej dostawy.',
        BLIK_NOT_CONFIGURED: ru ? 'Ручной BLIK временно недоступен: продавец не настроил номер получателя.' : 'Ręczny BLIK jest chwilowo niedostępny: sprzedawca nie skonfigurował numeru odbiorcy.',
        IDEMPOTENCY_CONFLICT: ru ? 'Данные заказа изменились. Проверьте форму и отправьте заказ снова.' : 'Dane zamówienia zostały zmienione. Sprawdź formularz i wyślij zamówienie ponownie.',
        LOCKER_INVALID: ru ? 'Введите корректный код постамата.' : 'Wpisz poprawny kod Paczkomatu.',
        STOCK_INVALID: ru ? 'Один из товаров больше недоступен.' : 'Jeden z produktów nie jest już dostępny.',
      };
      setStatus(errors[data.error] ?? text.orderError);
    } catch {
      setStatus(text.networkError);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    if (confirmation.paymentMethod === 'blik_before_dispatch') return <main className="wrap checkout checkout-dark"><BlikConfirmation confirmation={confirmation} locale={locale} /></main>;
    return <main className="wrap checkout checkout-dark"><section className="checkout-confirmation" aria-live="polite"><span className="eyebrow">{ru ? 'ЗАКАЗ СОЗДАН' : 'ZAMÓWIENIE UTWORZONE'}</span><h1 className="serif">{ru ? `Заказ № ${confirmation.orderNumber}` : `Zamówienie nr ${confirmation.orderNumber}`}</h1><p>{ru ? 'Заказ сохранён. Статус оплаты будет подтверждён вручную продавцом.' : 'Zamówienie zostało zapisane. Status płatności będzie potwierdzony ręcznie przez sprzedawcę.'}</p><p className="checkout-total"><span>{ru ? 'Итого' : 'Razem'}</span><strong>{formatPrice(confirmation.totalGrosz)}</strong></p></section></main>;
  }

  const appliedPromo = promo?.fingerprint === orderFingerprint ? promo : null;
  return <form className="wrap checkout checkout-dark" onSubmit={submit}>
    <section>
      <span className="eyebrow">{text.customerData}</span>
      <h1 className="serif">{text.checkoutTitle}</h1>
      {fields.map(([name]) => <label className="field" key={name}>{text[name]}<input autoComplete={name === 'email' ? 'email' : undefined} name={name} required type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'} /></label>)}
      <label className="field">{text.delivery}<select name="shipping" onChange={(event) => { invalidatePromo(); setDeliveryMethodId(event.target.value); setPaymentMethod(''); }} required value={deliveryMethodId}><option value="">{text.choose}</option>{deliveryMethods.map((method) => <option key={method.id} value={method.id}>{method.label} — {formatPrice(method.rate_grosz)}</option>)}</select></label>
      {(selectedDelivery?.kind === 'inpost_locker' || selectedDelivery?.kind === 'inpost_locker_cod') && <label className="field">{ru ? 'Код постамата InPost' : 'Kod Paczkomatu InPost'}<input name="lockerCode" required placeholder="np. WAW01A" pattern="[A-Za-z0-9_-]{3,40}" /></label>}
      <label className="field">{text.payment}<select disabled={!selectedDelivery} name="payment" onChange={(event) => { invalidatePromo(); setPaymentMethod(event.target.value); }} required value={paymentMethod}><option value="">{text.choose}</option>{selectedDelivery?.supports_blik_before_dispatch && blikAvailable && <option value="blik_before_dispatch">{text.blik}</option>}{selectedDelivery?.supports_cod && <option value="cod">{text.cod}</option>}{selectedDelivery?.kind === 'local_warsaw' && <option value="pay_on_local_delivery">{text.localPayment}</option>}</select></label>
      <label className="field">{text.promo}<span className="promo-row"><input name="promotion" value={promoCode} onChange={(event) => { invalidatePromo(); setPromoCode(event.target.value); }} placeholder={text.optional} type="text" /><button className="btn ghost" onClick={applyPromo} type="button">{ru ? 'Применить' : 'Zastosuj'}</button></span>{promoMessage && <small role="status">{promoMessage}</small>}</label>
      <label className="field">{text.notes}<textarea name="note" placeholder={text.optional} rows={3} /></label>
      <button className="btn" disabled={submitting || !acceptingOrders} type="submit">{submitting ? text.creating : text.createOrder}</button>
      {status && <p className="checkout-status" role="status">{status}</p>}
    </section>
    <aside className="summary">
      <h2 className="serif">{text.cart}</h2>
      {lines.length === 0 ? <p>{text.emptyCart}</p> : lines.map((item) => <p className="checkout-line" key={`${item.productId}-${item.variantId ?? 'standard'}`}><span>{localizedProduct(locale, { sku: item.sku, name: item.name, description: '' }).name} × {item.quantity}</span><strong>{formatPrice(item.price_grosz * item.quantity)}</strong></p>)}
      <p className="checkout-total"><span>{text.productsValue}</span><strong>{formatPrice(subtotal)}</strong></p>
      {appliedPromo && <p className="checkout-total"><span>{ru ? 'Скидка' : 'Rabat'} ({appliedPromo.code})</span><strong>−{formatPrice(appliedPromo.discountGrosz)}</strong></p>}
      <p className="checkout-total muted"><span>{text.delivery}</span><strong>{selectedDelivery ? formatPrice(appliedPromo ? appliedPromo.shippingGrosz : selectedDelivery.rate_grosz) : text.deliveryPending}</strong></p>
      {selectedDelivery && <p className="checkout-total"><span>{ru ? 'Итого' : 'Razem'}</span><strong>{formatPrice(appliedPromo ? appliedPromo.totalGrosz : subtotal + selectedDelivery.rate_grosz)}</strong></p>}
    </aside>
  </form>;
}
