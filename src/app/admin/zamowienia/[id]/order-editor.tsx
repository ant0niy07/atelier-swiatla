'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const fulfillment = [['new', 'Nowe'], ['awaiting_payment', 'Oczekuje na płatność'], ['paid', 'Opłacone'], ['processing', 'W przygotowaniu'], ['shipped', 'Nadane'], ['delivered', 'Dostarczone'], ['cancelled', 'Anulowane']] as const;
const payment = [['awaiting_payment', 'Oczekuje na płatność'], ['cod_pending', 'Pobranie — oczekuje'], ['paid', 'Opłacone'], ['carrier_collected', 'Pobrane przez przewoźnika'], ['settled', 'Rozliczone'], ['cancelled', 'Anulowane']] as const;

export function OrderEditor({ order }: { order: any }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const address = order.address ?? {};
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const test = form.get('is_test') === 'on';
    if (test && !order.is_test && !window.confirm(order.manual_payment_status === 'paid' ? 'To opłacone zamówienie. Oznaczenie jako test nie zmieni płatności. Kontynuować?' : 'Zamówienie zniknie z aktywnej listy i statystyk. Kontynuować?')) return;
    setSaving(true);
    const response = await fetch(`/api/admin/orders/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fulfillment_status: form.get('fulfillment_status'), manual_payment_status: form.get('manual_payment_status'), carrier_name: form.get('carrier_name') || null, tracking_number: form.get('tracking_number') || null, internal_note: form.get('internal_note') || undefined, is_test: test }) });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? 'Zmiany zapisane.' : data.error ?? 'Nie udało się zapisać zmian.');
    if (response.ok && test) router.replace('/admin/zamowienia');
    else if (response.ok) router.refresh();
  }
  return <div className="admin-order-grid">
    <section className="admin-order-card"><h2>Klient i dostawa</h2><p><strong>{order.customers?.first_name} {order.customers?.last_name}</strong><br />{order.email}<br />{order.customers?.phone ?? address.phone}</p><p>{address.street}<br />{address.postalCode} {address.city}</p><p><strong>{order.shipping_method}</strong><br />{order.payment_method}</p>{order.customer_note && <p>Uwagi klienta: {order.customer_note}</p>}</section>
    <section className="admin-order-card"><h2>Pozycje</h2>{order.order_items.map((item: any) => <p key={item.id}>{item.product_name} × {item.quantity}<span>{(item.line_total_grosz / 100).toFixed(2)} zł</span></p>)}<p><strong>Produkty</strong><span>{(order.subtotal_grosz / 100).toFixed(2)} zł</span></p><p><strong>Dostawa</strong><span>{(order.shipping_grosz / 100).toFixed(2)} zł</span></p>{order.discount_grosz > 0 && <p><strong>Rabat</strong><span>−{(order.discount_grosz / 100).toFixed(2)} zł</span></p>}<p className="admin-order-total"><strong>Razem</strong><span>{(order.total_grosz / 100).toFixed(2)} zł</span></p></section>
    <form className="admin-product-form" onSubmit={save}><h2>Obsługa zamówienia</h2><div className="admin-form-grid"><label>Realizacja<select name="fulfillment_status" defaultValue={order.fulfillment_status}>{fulfillment.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Płatność<select name="manual_payment_status" defaultValue={order.manual_payment_status}>{payment.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Przewoźnik<input name="carrier_name" defaultValue={order.carrier_name ?? ''} /></label><label>Numer śledzenia<input name="tracking_number" defaultValue={order.tracking_number ?? ''} /></label></div><label>Notatka wewnętrzna<textarea name="internal_note" rows={4} /></label><div className="admin-form-actions"><button className="btn" disabled={saving} type="submit">{saving ? 'Zapisywanie…' : 'Zapisz zmiany'}</button>{message && <p role="status">{message}</p>}</div></form>
    <section className="admin-order-card"><h2>Historia</h2>{order.order_status_history?.length ? order.order_status_history.map((entry: any, index: number) => <p key={index}>{new Date(entry.created_at).toLocaleString('pl-PL')} · {entry.status}{entry.note ? ` — ${entry.note}` : ''}</p>) : <p>Brak zapisów historii.</p>}</section>
  </div>;
}
