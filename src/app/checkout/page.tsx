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

export default function Checkout() {
  const { locale } = useLocale();
  const text = t(locale);
  const items = useCart((state) => state.items);
  const clear = useCart((state) => state.clear);
  const [attempted, setAttempted] = useState(false);
  const [deliveryMethods, setDeliveryMethods] = useState<Array<{id:string;label:string;kind:string;rate_grosz:number;minimum_order_grosz:number|null;supports_blik_before_dispatch:boolean;supports_cod:boolean}>>([]);
  const [acceptingOrders, setAcceptingOrders] = useState(true);
  const [blikAvailable, setBlikAvailable] = useState(false);
  const [deliveryMethodId, setDeliveryMethodId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutAttempt, setCheckoutAttempt] = useState<{key:string;fingerprint:string}|null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promo, setPromo] = useState<{discountGrosz:number;shippingGrosz:number;totalGrosz:number;code:string;fingerprint:string}|null>(null);
  const [promoMessage, setPromoMessage] = useState('');
  const previewRequest = useRef(0);
  const lines = useMemo(() => items, [items]);
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.price_grosz, 0);
  const orderFingerprint = `${deliveryMethodId}:${paymentMethod}:${lines.map((line) => `${line.sku}:${line.variantId??''}:${line.quantity}`).sort().join('|')}`;

  useEffect(() => { fetch('/api/checkout').then(async (response) => response.ok ? response.json() : Promise.reject()).then((data) => { setDeliveryMethods(data.deliveryMethods ?? []); setAcceptingOrders(data.acceptingOrders !== false); setBlikAvailable(Boolean(data.blikAvailable)); }).catch(() => setStatus(t(locale).deliveryError)); }, [locale, text.deliveryError]);
  const selectedDelivery = deliveryMethods.find((method) => method.id === deliveryMethodId);
  async function applyPromo() {
    if (!promoCode.trim() || !deliveryMethodId) { setPromoMessage(locale === 'ru' ? 'Сначала выберите доставку и введите код.' : 'Najpierw wybierz dostawę i wpisz kod.'); return; }
    const requestId = ++previewRequest.current;
    setPromoMessage(locale === 'ru' ? 'Проверка кода…' : 'Sprawdzanie kodu…');
    try {
      const response = await fetch('/api/promo-preview', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ code: promoCode, deliveryMethodId, items: lines.map((item) => ({ sku:item.sku, quantity:item.quantity })) }) });
      const data = await response.json().catch(() => ({}));
      if (requestId !== previewRequest.current) return;
      if (response.ok) { setPromo({ ...data, fingerprint: orderFingerprint }); setPromoMessage(locale === 'ru' ? 'Промокод применён.' : 'Kod rabatowy został zastosowany.'); }
      else if (data.error === 'DELIVERY_MINIMUM_NOT_MET') setPromoMessage(locale === 'ru' ? 'Не достигнута минимальная сумма для выбранной доставки.' : 'Nie osiągnięto minimalnej kwoty dla wybranej dostawy.');
      else setPromoMessage(locale === 'ru' ? 'Промокод недействителен или условия не выполнены.' : 'Kod rabatowy jest nieważny lub warunki nie są spełnione.');
    } catch {
      if (requestId === previewRequest.current) { setPromo(null); setPromoMessage(locale === 'ru' ? 'Не удалось проверить код. Попробуйте снова.' : 'Nie udało się sprawdzić kodu. Spróbuj ponownie.'); }
    }
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    const form = new FormData(event.currentTarget);
    if (!acceptingOrders) { setStatus(locale === 'ru' ? 'Приём заказов временно приостановлен.' : 'Przyjmowanie zamówień jest chwilowo wstrzymane.'); return; }
    if (!selectedDelivery || !paymentMethod || lines.length === 0) { setStatus(text.selectDelivery); return; }
    if (selectedDelivery.minimum_order_grosz !== null && subtotal < selectedDelivery.minimum_order_grosz) { setStatus(locale === 'ru' ? 'Не достигнута минимальная сумма для выбранной доставки.' : 'Nie osiągnięto minimalnej kwoty dla wybranej dostawy.'); return; }
    const draft = {
      deliveryMethodId, paymentMethod, promoCode: String(form.get('promotion') || ''), note: String(form.get('note') || ''), lockerCode: String(form.get('lockerCode') || ''),
      customer: { firstName: String(form.get('firstName') || ''), lastName: String(form.get('lastName') || ''), email: String(form.get('email') || ''), phone: String(form.get('phone') || ''), street: String(form.get('street') || ''), postalCode: String(form.get('postalCode') || ''), city: String(form.get('city') || '') },
      items: lines.map((item) => ({ sku: item.sku, variantId: item.variantId, quantity: item.quantity })),
    };
    const fingerprint = JSON.stringify(draft);
    const key = checkoutAttempt?.fingerprint === fingerprint ? checkoutAttempt.key : crypto.randomUUID();
    if (checkoutAttempt?.fingerprint !== fingerprint) setCheckoutAttempt({ key, fingerprint });
    setSubmitting(true);
    setStatus(text.creating);
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        idempotencyKey: key, ...draft,
      }) });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.orderNumber) {
        clear();
        setCheckoutAttempt(null);
        setStatus(`${text.orderSuccess.replace('{number}', String(data.orderNumber))} ${formatPrice(data.totalGrosz)}`);
      } else {
        const errors:Record<string,string>={
          DELIVERY_MINIMUM_NOT_MET:locale==='ru'?'Не достигнута минимальная сумма для выбранной доставки.':'Nie osiągnięto minimalnej kwoty dla wybranej dostawy.',
          BLIK_NOT_CONFIGURED:locale==='ru'?'Ручной BLIK временно недоступен: продавец не настроил номер получателя.':'Ręczny BLIK jest chwilowo niedostępny: sprzedawca nie skonfigurował numeru odbiorcy.',
          IDEMPOTENCY_CONFLICT:locale==='ru'?'Данные заказа изменились. Проверьте форму и отправьте заказ снова.':'Dane zamówienia zostały zmienione. Sprawdź formularz i wyślij zamówienie ponownie.',
          LOCKER_INVALID:locale==='ru'?'Введите корректный код постамата.':'Wpisz poprawny kod Paczkomatu.',
          STOCK_INVALID:locale==='ru'?'Один из товаров больше недоступен.':'Jeden z produktów nie jest już dostępny.',
        };
        setStatus(errors[data.error] ?? text.orderError);
      }
    } catch {
      setStatus(text.networkError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="wrap checkout checkout-dark" onSubmit={submit}>
      <section>
        <span className="eyebrow">{text.customerData}</span>
        <h1 className="serif">{text.checkoutTitle}</h1>
        {fields.map(([name, label]) => (
          <label className="field" key={name}>{text[name]}
            <input autoComplete={name === 'email' ? 'email' : undefined} name={name} required type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'} />
          </label>
        ))}
        <label className="field">{text.delivery}
          <select name="shipping" onChange={(event) => { previewRequest.current+=1; setPromo(null);setPromoMessage('');setDeliveryMethodId(event.target.value); setPaymentMethod(''); }} required value={deliveryMethodId}><option value="">{text.choose}</option>{deliveryMethods.map((method) => <option key={method.id} value={method.id}>{method.label} — {formatPrice(method.rate_grosz)}</option>)}</select>
        </label>
        {selectedDelivery?.kind === 'inpost_locker' || selectedDelivery?.kind === 'inpost_locker_cod' ? <label className="field">{locale==='ru'?'Код постамата InPost':'Kod Paczkomatu InPost'}<input name="lockerCode" required placeholder="np. WAW01A" pattern="[A-Za-z0-9_-]{3,40}" /></label> : null}
        <label className="field">{text.payment}
          <select disabled={!selectedDelivery} name="payment" onChange={(event) => setPaymentMethod(event.target.value)} required value={paymentMethod}><option value="">{text.choose}</option>{selectedDelivery?.supports_blik_before_dispatch && blikAvailable && <option value="blik_before_dispatch">{text.blik}</option>}{selectedDelivery?.supports_cod && <option value="cod">{text.cod}</option>}{selectedDelivery?.kind === 'local_warsaw' && <option value="pay_on_local_delivery">{text.localPayment}</option>}</select>
        </label>
        <label className="field">{text.promo}<span className="promo-row"><input name="promotion" value={promoCode} onChange={(event)=>{previewRequest.current+=1;setPromoCode(event.target.value);setPromo(null);setPromoMessage('')}} placeholder={text.optional} type="text" /><button className="btn ghost" onClick={applyPromo} type="button">{locale==='ru'?'Применить':'Zastosuj'}</button></span>{promoMessage&&<small role="status">{promoMessage}</small>}</label>
        <label className="field">{text.notes}<textarea name="note" placeholder={text.optional} rows={3} /></label>
        <button className="btn" disabled={submitting || !acceptingOrders} type="submit">{submitting ? text.creating : text.createOrder}</button>
        {(attempted || status) && <p className="checkout-status" role="status">{status}</p>}
      </section>
      <aside className="summary">
        <h2 className="serif">{text.cart}</h2>
        {lines.length === 0 ? <p>{text.emptyCart}</p> : lines.map((item) => {
          return <p className="checkout-line" key={`${item.productId}-${item.variantId ?? 'standard'}`}><span>{localizedProduct(locale,{sku:item.sku,name:item.name,description:''}).name} × {item.quantity}{item.variantName && <small>{item.variantName}</small>}</span><strong>{formatPrice(item.price_grosz * item.quantity)}</strong></p>;
        })}
        <p className="checkout-total"><span>{text.productsValue}</span><strong>{formatPrice(subtotal)}</strong></p>
        {promo?.fingerprint===orderFingerprint && <p className="checkout-total"><span>{locale==='ru'?'Скидка':'Rabat'} ({promo.code})</span><strong>−{formatPrice(promo.discountGrosz)}</strong></p>}
        <p className="checkout-total muted"><span>{text.delivery}</span><strong>{selectedDelivery ? formatPrice(promo?.fingerprint===orderFingerprint ? promo.shippingGrosz : selectedDelivery.rate_grosz) : text.deliveryPending}</strong></p>
        {selectedDelivery && <p className="checkout-total"><span>{locale==='ru'?'Итого':'Razem'}</span><strong>{formatPrice(promo?.fingerprint===orderFingerprint ? promo.totalGrosz : subtotal + selectedDelivery.rate_grosz)}</strong></p>}
      </aside>
    </form>
  );
}
