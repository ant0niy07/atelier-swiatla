'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  const [deliveryMethods, setDeliveryMethods] = useState<Array<{id:string;label:string;kind:string;rate_grosz:number;supports_blik_before_dispatch:boolean;supports_cod:boolean}>>([]);
  const [deliveryMethodId, setDeliveryMethodId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promo, setPromo] = useState<{discountGrosz:number;shippingGrosz:number;totalGrosz:number;code:string}|null>(null);
  const [promoMessage, setPromoMessage] = useState('');
  const lines = useMemo(() => items, [items]);
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.price_grosz, 0);

  useEffect(() => { fetch('/api/checkout').then(async (response) => response.ok ? response.json() : Promise.reject()).then((data) => setDeliveryMethods(data.deliveryMethods ?? [])).catch(() => setStatus(t(locale).deliveryError)); }, [locale]);
  const selectedDelivery = deliveryMethods.find((method) => method.id === deliveryMethodId);
  async function applyPromo() {
    if (!promoCode.trim() || !deliveryMethodId) { setPromoMessage(locale === 'ru' ? 'Сначала выберите доставку и введите код.' : 'Najpierw wybierz dostawę i wpisz kod.'); return; }
    setPromoMessage(locale === 'ru' ? 'Проверка кода…' : 'Sprawdzanie kodu…');
    const response = await fetch('/api/promo-preview', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ code: promoCode, deliveryMethodId, items: lines.map((item) => ({ sku:item.sku, quantity:item.quantity })) }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setPromo(data); setPromoMessage(locale === 'ru' ? 'Промокод применён.' : 'Kod rabatowy został zastosowany.'); } else { setPromo(null); setPromoMessage(locale === 'ru' ? 'Промокод недействителен или условия не выполнены.' : 'Kod rabatowy jest nieważny lub warunki nie są spełnione.'); }
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    const form = new FormData(event.currentTarget);
    if (!selectedDelivery || !paymentMethod || lines.length === 0) { setStatus(text.selectDelivery); return; }
    const key = idempotencyKey ?? crypto.randomUUID();
    if (!idempotencyKey) setIdempotencyKey(key);
    setSubmitting(true);
    setStatus(text.creating);
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        idempotencyKey: key, deliveryMethodId, paymentMethod, promoCode: form.get('promotion') || undefined, note: form.get('note') || undefined,
        customer: { firstName: form.get('firstName'), lastName: form.get('lastName'), email: form.get('email'), phone: form.get('phone'), street: form.get('street'), postalCode: form.get('postalCode'), city: form.get('city') },
        items: lines.map((item) => ({ sku: item.sku, variantId: item.variantId, quantity: item.quantity })),
      }) });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.orderNumber) {
        clear();
        setIdempotencyKey(null);
        setStatus(text.orderSuccess.replace('{number}', String(data.orderNumber)));
      } else {
        setStatus(data.error ?? text.orderError);
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
          <select name="shipping" onChange={(event) => { setDeliveryMethodId(event.target.value); setPaymentMethod(''); }} required value={deliveryMethodId}><option value="">{text.choose}</option>{deliveryMethods.map((method) => <option key={method.id} value={method.id}>{method.label} — {formatPrice(method.rate_grosz)}</option>)}</select>
        </label>
        <label className="field">{text.payment}
          <select disabled={!selectedDelivery} name="payment" onChange={(event) => setPaymentMethod(event.target.value)} required value={paymentMethod}><option value="">{text.choose}</option>{selectedDelivery?.supports_blik_before_dispatch && <option value="blik_before_dispatch">{text.blik}</option>}{selectedDelivery?.supports_cod && <option value="cod">{text.cod}</option>}{selectedDelivery?.kind === 'local_warsaw' && <option value="pay_on_local_delivery">{text.localPayment}</option>}</select>
        </label>
        <label className="field">{text.promo}<span className="promo-row"><input name="promotion" value={promoCode} onChange={(event)=>{setPromoCode(event.target.value);setPromo(null)}} placeholder={text.optional} type="text" /><button className="btn ghost" onClick={applyPromo} type="button">{locale==='ru'?'Применить':'Zastosuj'}</button></span>{promoMessage&&<small role="status">{promoMessage}</small>}</label>
        <label className="field">{text.notes}<textarea name="note" placeholder={text.optional} rows={3} /></label>
        <button className="btn" disabled={submitting} type="submit">{submitting ? text.creating : text.createOrder}</button>
        {(attempted || status) && <p className="checkout-status" role="status">{status}</p>}
      </section>
      <aside className="summary">
        <h2 className="serif">{text.cart}</h2>
        {lines.length === 0 ? <p>{text.emptyCart}</p> : lines.map((item) => {
          return <p className="checkout-line" key={`${item.productId}-${item.variantId ?? 'standard'}`}><span>{localizedProduct(locale,{sku:item.sku,name:item.name,description:''}).name} × {item.quantity}{item.variantName && <small>{item.variantName}</small>}</span><strong>{formatPrice(item.price_grosz * item.quantity)}</strong></p>;
        })}
        <p className="checkout-total"><span>{text.productsValue}</span><strong>{formatPrice(subtotal)}</strong></p>
        {promo && <p className="checkout-total"><span>{locale==='ru'?'Скидка':'Rabat'} ({promo.code})</span><strong>−{formatPrice(promo.discountGrosz)}</strong></p>}
        <p className="checkout-total muted"><span>{text.delivery}</span><strong>{selectedDelivery ? formatPrice(promo?.shippingGrosz ?? selectedDelivery.rate_grosz) : text.deliveryPending}</strong></p>
        {selectedDelivery && <p className="checkout-total"><span>{locale==='ru'?'Итого':'Razem'}</span><strong>{formatPrice(promo?.totalGrosz ?? subtotal + selectedDelivery.rate_grosz)}</strong></p>}
      </aside>
    </form>
  );
}
