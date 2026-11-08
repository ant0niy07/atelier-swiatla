'use client';

import { FormEvent, useMemo, useState } from 'react';

type Value = Record<string, string | boolean>;
type Row = { key: string; value: Value };

export function SettingsEditor({ settings }: { settings: Row[] }) {
  const initial = useMemo(() => Object.fromEntries(settings.map((item) => [item.key, item.value])) as Record<string, Value>, [settings]);
  const [contact, setContact] = useState<Value>(initial.store_contact ?? {});
  const [operations, setOperations] = useState<Value>({ accepting_orders: initial.store_operations?.accepting_orders !== false, ...initial.store_operations });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const [contactResponse, operationsResponse] = await Promise.all([
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'store_contact', value: contact }) }),
        fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'store_operations', value: operations }) }),
      ]);
      setMessage(contactResponse.ok && operationsResponse.ok ? 'Ustawienia zapisane.' : 'Nie udało się zapisać ustawień.');
    } catch {
      setMessage('Nie udało się połączyć z serwerem.');
    } finally {
      setSaving(false);
    }
  }

  async function testTelegram() {
    const response = await fetch('/api/admin/telegram-test', { method: 'POST' });
    setMessage(response.ok ? 'Powiadomienie testowe zostało przyjęte przez Telegram.' : 'Nie udało się wysłać testu Telegram. Sprawdź konfigurację.');
  }

  return <form className="admin-product-form" onSubmit={save}>
    <h2>Dane sklepu</h2>
    <div className="admin-form-grid">
      <label>Nazwa firmy<input value={String(contact.company_name ?? '')} onChange={(event) => setContact({ ...contact, company_name: event.target.value })} /></label>
      <label>E-mail kontaktowy<input type="email" value={String(contact.email ?? '')} onChange={(event) => setContact({ ...contact, email: event.target.value })} /></label>
      <label>Telefon<input value={String(contact.phone ?? '')} onChange={(event) => setContact({ ...contact, phone: event.target.value })} /></label>
      <label>Adres<input value={String(contact.address ?? '')} onChange={(event) => setContact({ ...contact, address: event.target.value })} /></label>
    </div>
    <h2>Obsługa zamówień</h2>
    <label className="admin-checkbox"><input type="checkbox" checked={operations.accepting_orders !== false} onChange={(event) => setOperations({ ...operations, accepting_orders: event.target.checked })} /> Przyjmowanie zamówień</label>
    <div className="admin-form-grid">
      <label>Telefon do ręcznego przelewu BLIK<input inputMode="tel" placeholder="+48 …" value={String(operations.blik_phone ?? '')} onChange={(event) => setOperations({ ...operations, blik_phone: event.target.value })} /></label>
      <label>Szacowany czas realizacji<input placeholder="np. potwierdzany indywidualnie" value={String(operations.production_lead_time ?? '')} onChange={(event) => setOperations({ ...operations, production_lead_time: event.target.value })} /></label>
      <label>Adres zwrotów<textarea rows={2} placeholder="Uzupełnij po potwierdzeniu" value={String(operations.return_address ?? '')} onChange={(event) => setOperations({ ...operations, return_address: event.target.value })} /></label>
    </div>
    <p className="admin-help">Telefon BLIK jest odczytywany z tych ustawień i pokazywany wyłącznie po prawidłowym utworzeniu zamówienia BLIK. Nie wpisuj kodów BLIK klientów.</p>
    <label>Informacja dla klienta<textarea rows={4} value={String(operations.customer_message ?? '')} onChange={(event) => setOperations({ ...operations, customer_message: event.target.value })} /></label>
    <div className="admin-form-actions"><button className="btn" disabled={saving}>{saving ? 'Zapisywanie…' : 'Zapisz ustawienia'}</button><button className="btn ghost" onClick={testTelegram} type="button">Wyślij powiadomienie testowe</button>{message && <p role="status">{message}</p>}</div>
  </form>;
}
