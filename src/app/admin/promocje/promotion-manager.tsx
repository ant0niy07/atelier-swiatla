'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Promotion = {
  id: string;
  code: string;
  kind: 'percentage' | 'fixed' | 'free_shipping';
  value: number;
  active: boolean;
  used_count: number;
  usage_limit: number | null;
  ends_at: string | null;
  starts_at: string;
  min_order_grosz: number;
  max_discount_grosz: number | null;
  internal_note: string;
};

const toLocal = (value: string) => value.slice(0, 16);
const newPromotion = (): Promotion => ({
  id: '', code: '', kind: 'percentage', value: 10, active: false,
  used_count: 0, usage_limit: null, ends_at: null, starts_at: new Date().toISOString(),
  min_order_grosz: 0, max_discount_grosz: null, internal_note: '',
});

export function PromotionManager({ promotions }: { promotions: Promotion[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Promotion | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = new Date(String(form.get('start')));
    const end = form.get('end') ? new Date(String(form.get('end'))) : null;
    const kind = String(form.get('kind'));
    const value = Number(form.get('value'));
    if (Number.isNaN(start.valueOf()) || (end && end <= start)) {
      setMessage('Data zakończenia musi być późniejsza niż data rozpoczęcia.');
      return;
    }
    if ((kind === 'percentage' && (value < 1 || value > 100)) || (kind === 'free_shipping' && value !== 1)) {
      setMessage('Nieprawidłowa wartość rabatu.');
      return;
    }
    const data = {
      ...(selected?.id ? { id: selected.id } : {}),
      code: String(form.get('code')).toUpperCase(),
      kind,
      value,
      min_order_grosz: Math.round(Number(form.get('min')) * 100),
      max_discount_grosz: form.get('cap') ? Math.round(Number(form.get('cap')) * 100) : null,
      starts_at: start.toISOString(),
      ends_at: end?.toISOString() ?? null,
      usage_limit: form.get('limit') ? Number(form.get('limit')) : null,
      active: form.get('active') === 'on',
      internal_note: String(form.get('note') ?? ''),
    };
    setSaving(true);
    try {
      const response = await fetch('/api/admin/promotions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      const result = await response.json().catch(() => ({}));
      setMessage(response.ok ? 'Promocja zapisana.' : result.error === 'INVALID_PROMOTION'
        ? 'Sprawdź kod, daty i wartość rabatu.'
        : result.error === 'SAVE_FAILED' ? 'Kod jest już używany lub nie można go zapisać.'
          : 'Nie udało się zapisać promocji.');
      if (response.ok) router.refresh();
    } catch {
      setMessage('Błąd sieci. Spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  }

  const promotion = selected;
  return <div className="admin-products">
    <div className="admin-products-toolbar">
      <button className="btn" type="button" onClick={() => setSelected(newPromotion())}>Utwórz kod rabatowy</button>
    </div>
    <p className="admin-help">Rabaty procentowe i kwotowe są naliczane od całej wartości zamówienia, łącznie z dostawą. Darmowa dostawa obniża wyłącznie koszt dostawy.</p>
    <div className="admin-products-layout">
      <section className="admin-products-list">
        {promotions.map((item) => <button className={selected?.id === item.id ? 'admin-product-row active' : 'admin-product-row'} type="button" key={item.id} onClick={() => setSelected(item)}>
          <span><strong>{item.code}</strong><small>{item.kind} · użyto {item.used_count}</small></span>
          <em>{item.active ? 'Aktywna' : 'Wyłączona'}</em>
        </button>)}
      </section>
      {promotion && <form className="admin-product-form" onSubmit={save}>
        <h2>{promotion.id ? 'Edytuj kod' : 'Nowy kod'}</h2>
        <p className="admin-help">Kod działa dla całego koszyka. Ograniczenia produktów i kategorii nie mają zastosowania do nowych zamówień.</p>
        <div className="admin-form-grid">
          <label>Kod<input name="code" required pattern="[A-Z0-9-]{3,40}" defaultValue={promotion.code} /></label>
          <label>Rodzaj<select name="kind" defaultValue={promotion.kind}><option value="percentage">Procent od zamówienia z dostawą</option><option value="fixed">Kwota od zamówienia z dostawą</option><option value="free_shipping">Darmowa dostawa</option></select></label>
          <label>Wartość<input name="value" type="number" min="1" defaultValue={promotion.value} /></label>
          <label>Minimum produktów (zł)<input name="min" type="number" min="0" step=".01" defaultValue={(promotion.min_order_grosz / 100).toFixed(2)} /></label>
          <label>Limit użyć<input name="limit" type="number" min="1" defaultValue={promotion.usage_limit ?? ''} /></label>
          <label>Limit rabatu (zł)<input name="cap" type="number" min="0" step=".01" defaultValue={promotion.max_discount_grosz === null ? '' : (promotion.max_discount_grosz / 100).toFixed(2)} /></label>
          <label>Start<input name="start" type="datetime-local" defaultValue={toLocal(promotion.starts_at)} /></label>
          <label>Koniec<input name="end" type="datetime-local" defaultValue={promotion.ends_at ? toLocal(promotion.ends_at) : ''} /></label>
        </div>
        <label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked={promotion.active} /> Aktywna</label>
        <label>Notatka<textarea name="note" rows={3} defaultValue={promotion.internal_note} /></label>
        <div className="admin-form-actions"><button className="btn" disabled={saving}>{saving ? 'Zapisywanie…' : 'Zapisz kod'}</button>{message && <p role="status">{message}</p>}</div>
      </form>}
    </div>
  </div>;
}
