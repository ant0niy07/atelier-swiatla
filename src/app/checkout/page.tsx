'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { formatPrice } from '@/data/products';
import { useCart } from '@/stores/cart-store';

const fields = [
  ['firstName', 'Imię'], ['lastName', 'Nazwisko'], ['email', 'Adres e-mail'], ['phone', 'Numer telefonu'],
  ['street', 'Ulica i numer'], ['postalCode', 'Kod pocztowy'], ['city', 'Miasto'],
] as const;

export default function Checkout() {
  const items = useCart((state) => state.items);
  const [attempted, setAttempted] = useState(false);
  const [deliveryMethods, setDeliveryMethods] = useState<Array<{id:string;label:string;kind:string;rate_grosz:number;supports_blik_before_dispatch:boolean;supports_cod:boolean}>>([]);
  const [deliveryMethodId, setDeliveryMethodId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('');
  const lines = useMemo(() => items, [items]);
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.price_grosz, 0);

  useEffect(() => { fetch('/api/checkout').then(async (response) => response.ok ? response.json() : Promise.reject()).then((data) => setDeliveryMethods(data.deliveryMethods ?? [])).catch(() => setStatus('Nie udało się pobrać dostępnych metod dostawy.')); }, []);
  const selectedDelivery = deliveryMethods.find((method) => method.id === deliveryMethodId);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    const form = new FormData(event.currentTarget);
    if (!selectedDelivery || !paymentMethod || lines.length === 0) { setStatus('Wybierz dostawę i płatność oraz sprawdź koszyk.'); return; }
    setStatus('Tworzenie zamówienia…');
    const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(), deliveryMethodId, paymentMethod, promoCode: form.get('promotion') || undefined, note: form.get('note') || undefined,
      customer: { firstName: form.get('firstName'), lastName: form.get('lastName'), email: form.get('email'), phone: form.get('phone'), street: form.get('street'), postalCode: form.get('postalCode'), city: form.get('city') },
      items: lines.map((item) => ({ sku: item.sku, variantId: item.variantId, quantity: item.quantity })),
    }) });
    const data = await response.json().catch(() => ({}));
    setStatus(response.ok ? `Zamówienie nr ${data.orderNumber} zostało przyjęte. Płatność oczekuje na weryfikację.` : data.error ?? 'Nie udało się utworzyć zamówienia.');
  };

  return (
    <form className="wrap checkout checkout-dark" onSubmit={submit}>
      <section>
        <span className="eyebrow">Dane zamówienia</span>
        <h1 className="serif">Podsumowanie</h1>
        {fields.map(([name, label]) => (
          <label className="field" key={name}>{label}
            <input autoComplete={name === 'email' ? 'email' : undefined} name={name} required type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'} />
          </label>
        ))}
        <label className="field">Metoda dostawy
          <select name="shipping" onChange={(event) => { setDeliveryMethodId(event.target.value); setPaymentMethod(''); }} required value={deliveryMethodId}><option value="">Wybierz dostawę</option>{deliveryMethods.map((method) => <option key={method.id} value={method.id}>{method.label} — {formatPrice(method.rate_grosz)}</option>)}</select>
        </label>
        <label className="field">Metoda płatności
          <select disabled={!selectedDelivery} name="payment" onChange={(event) => setPaymentMethod(event.target.value)} required value={paymentMethod}><option value="">Wybierz płatność</option>{selectedDelivery?.supports_blik_before_dispatch && <option value="blik_before_dispatch">BLIK przed wysyłką</option>}{selectedDelivery?.supports_cod && <option value="cod">Płatność za pobraniem</option>}{selectedDelivery?.kind === 'local_warsaw' && <option value="pay_on_local_delivery">Płatność przy odbiorze</option>}</select>
        </label>
        <label className="field">Kod promocyjny<input name="promotion" placeholder="Opcjonalnie" type="text" /></label>
        <label className="field">Uwagi do zamówienia<textarea name="note" placeholder="Opcjonalnie" rows={3} /></label>
        <button className="btn" type="submit">Przejdź do potwierdzenia</button>
        {(attempted || status) && <p className="checkout-status" role="status">{status}</p>}
      </section>
      <aside className="summary">
        <h2 className="serif">Twój koszyk</h2>
        {lines.length === 0 ? <p>Koszyk jest pusty.</p> : lines.map((item) => {
          return <p className="checkout-line" key={`${item.productId}-${item.variantId ?? 'standard'}`}><span>{item.name} × {item.quantity}{item.variantName && <small>{item.variantName}</small>}</span><strong>{formatPrice(item.price_grosz * item.quantity)}</strong></p>;
        })}
        <p className="checkout-total"><span>Wartość produktów</span><strong>{formatPrice(subtotal)}</strong></p>
        <p className="checkout-total muted"><span>Dostawa</span><strong>Do potwierdzenia</strong></p>
      </aside>
    </form>
  );
}
