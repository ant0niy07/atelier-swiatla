'use client';

import { FormEvent, useMemo, useState } from 'react';
import { formatPrice, products } from '@/data/products';
import { useCart } from '@/stores/cart-store';

const fields = [
  ['firstName', 'Imię'], ['lastName', 'Nazwisko'], ['email', 'Adres e-mail'], ['phone', 'Numer telefonu'],
  ['street', 'Ulica i numer'], ['postalCode', 'Kod pocztowy'], ['city', 'Miasto'],
] as const;

export default function Checkout() {
  const items = useCart((state) => state.items);
  const [attempted, setAttempted] = useState(false);
  const lines = useMemo(() => items.map((item) => ({ item, product: products.find((product) => product.id === item.productId) })).filter((line): line is { item: typeof items[number]; product: typeof products[number] } => Boolean(line.product)), [items]);
  const subtotal = lines.reduce((sum, line) => sum + line.item.quantity * line.product.price, 0);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
  };

  return (
    <form className="wrap checkout checkout-dark" onSubmit={submit}>
      <section>
        <span className="eyebrow">Dane zamówienia</span>
        <h1 className="serif">Podsumowanie</h1>
        <div className="notice"><strong>Finalizacja zamówienia jest jeszcze zablokowana.</strong> Koszyk działa, jednak przyjęcie zamówienia wymaga potwierdzonych stanów magazynowych, cen, dostawy, płatności i konfiguracji Supabase.</div>
        {fields.map(([name, label]) => (
          <label className="field" key={name}>{label}
            <input autoComplete={name === 'email' ? 'email' : undefined} name={name} required type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'} />
          </label>
        ))}
        <label className="field">Metoda dostawy
          <select defaultValue="pending" name="shipping" required><option value="pending">Wybór dostawy po konfiguracji usług</option></select>
        </label>
        <label className="field">Metoda płatności
          <select defaultValue="pending" name="payment" required><option value="pending">Wybierz dostawę, aby zobaczyć dostępne płatności</option></select>
        </label>
        <label className="field">Kod promocyjny<input name="promotion" placeholder="Opcjonalnie" type="text" /></label>
        <label className="field">Uwagi do zamówienia<textarea name="note" placeholder="Opcjonalnie" rows={3} /></label>
        <button className="btn" type="submit">Przejdź do potwierdzenia</button>
        {attempted && <p className="checkout-status" role="status">Nie można jeszcze złożyć zamówienia. Nie pobrano płatności ani nie utworzono zamówienia.</p>}
      </section>
      <aside className="summary">
        <h2 className="serif">Twój koszyk</h2>
        {lines.length === 0 ? <p>Koszyk jest pusty.</p> : lines.map(({ item, product }) => {
          const variant = product.variants?.find((entry) => entry.id === item.variantId);
          return <p className="checkout-line" key={`${product.id}-${item.variantId ?? 'standard'}`}><span>{product.name} × {item.quantity}{variant && <small>{variant.name}</small>}</span><strong>{formatPrice(product.price * item.quantity)}</strong></p>;
        })}
        <p className="checkout-total"><span>Wartość produktów</span><strong>{formatPrice(subtotal)}</strong></p>
        <p className="checkout-total muted"><span>Dostawa</span><strong>Do potwierdzenia</strong></p>
      </aside>
    </form>
  );
}
