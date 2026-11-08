'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Category = { id: string; name: string; slug: string; active: boolean; publishedCount: number };
type Draft = Omit<Category, 'id' | 'publishedCount'> & { id?: string };
const blank: Draft = { name: '', slug: '', active: true };

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    const response = await fetch('/api/admin/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
    });
    setSaving(false);
    if (!response.ok) {
      setNotice('Nie udało się zapisać kategorii. Sprawdź nazwę i unikalność adresu URL.');
      return;
    }
    setNotice('Kategoria zapisana.');
    router.refresh();
  }

  return (
    <div className="admin-products">
      <div className="admin-products-toolbar"><button className="btn" onClick={() => { setNotice(''); setDraft({ ...blank }); }} type="button">Dodaj kategorię</button></div>
      <div className="admin-products-layout">
        <section className="admin-products-list">
          {categories.map((category) => <button className={draft?.id === category.id ? 'admin-product-row active' : 'admin-product-row'} key={category.id} onClick={() => { setNotice(''); const { publishedCount: _, ...editable } = category; setDraft(editable); }} type="button"><span><strong>{category.name}</strong><small>/{category.slug} · {category.publishedCount} opublikowanych</small></span><em>{category.active ? 'Aktywna' : 'Ukryta'}</em></button>)}
        </section>
        {draft && <form className="admin-product-form" onSubmit={submit}>
          <div className="admin-form-heading"><h2>{draft.id ? 'Edytuj kategorię' : 'Nowa kategoria'}</h2><button className="text-button" type="button" onClick={() => setDraft(null)}>Zamknij</button></div>
          <div className="admin-form-grid">
            <label>Nazwa<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value, slug: draft.id ? draft.slug : slugify(event.target.value) })} /></label>
            <label>Adres URL<input required pattern="[a-z0-9-]+" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: slugify(event.target.value) })} /></label>
          </div>
          <label className="admin-checkbox"><input checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} type="checkbox" /> Kategoria aktywna</label>
          <p className="admin-help">Aktywna kategoria pojawia się od razu w kolekcji. Wyłączenie ukrywa ją na witrynie, ale nie usuwa produktów ani danych zamówień.</p>
          <div className="admin-form-actions"><button className="btn" disabled={saving} type="submit">{saving ? 'Zapisywanie…' : 'Zapisz kategorię'}</button>{notice && <p role="status">{notice}</p>}</div>
        </form>}
      </div>
    </div>
  );
}
