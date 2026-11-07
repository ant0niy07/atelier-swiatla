'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'draft' | 'published' | 'archived';
type ProductImage = { id: string; storage_path: string; position: number };
type Product = {
  id: string; name: string; slug: string; sku: string; description: string;
  price_grosz: number; stock_on_hand: number; made_to_order: boolean;
  status: Status; category_id: string | null; fragrance: string | null;
  product_images: ProductImage[] | null;
};
type Category = { id: string; name: string; slug: string; active: boolean };
type FormState = Omit<Product, 'id' | 'product_images'> & { id?: string };

const blank: FormState = {
  name: '', slug: '', sku: '', description: '', price_grosz: 0,
  stock_on_hand: 0, made_to_order: true, status: 'draft', category_id: null, fragrance: null,
};

function toForm(product: Product): FormState {
  const { id, product_images, ...values } = product;
  return { id, ...values };
}

function makeSlug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function ProductManager({ products, categories }: { products: Product[]; categories: Category[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<FormState | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const selected = useMemo(() => products.find((product) => product.id === editing?.id), [editing?.id, products]);
  const filtered = useMemo(() => products.filter((product) => {
    const value = `${product.name} ${product.sku}`.toLowerCase();
    return value.includes(query.toLowerCase()) && (status === 'all' || product.status === status);
  }), [products, query, status]);

  function startNew() {
    setNotice('');
    setFiles([]);
    setEditing({ ...blank });
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setEditing((current) => current ? { ...current, [key]: value } : current);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setNotice('');
    const response = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    const payload = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !payload?.product) {
      setNotice('Nie udało się zapisać produktu. Sprawdź wymagane pola i unikalność SKU oraz adresu URL.');
      return;
    }
    setEditing(toForm(payload.product));
    setNotice('Produkt zapisany.');
    router.refresh();
  }

  async function upload() {
    if (!editing?.id || !files.length) return;
    setUploading(true);
    setNotice('');
    const body = new FormData();
    files.forEach((file) => body.append('images', file));
    const response = await fetch(`/api/admin/products/${editing.id}/images`, { method: 'POST', body });
    setUploading(false);
    if (!response.ok) {
      setNotice('Nie udało się przesłać zdjęć. Akceptowane są JPEG, PNG, WebP i AVIF do 5 MB.');
      return;
    }
    setFiles([]);
    setNotice('Zdjęcia zostały przesłane.');
    router.refresh();
  }

  return (
    <div className="admin-products">
      <div className="admin-products-toolbar">
        <label><span>Wyszukaj</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nazwa lub SKU" /></label>
        <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as 'all' | Status)}><option value="all">Wszystkie</option><option value="draft">Szkice</option><option value="published">Opublikowane</option><option value="archived">Archiwum</option></select></label>
        <button className="btn" type="button" onClick={startNew}>Dodaj produkt</button>
      </div>

      <div className="admin-products-layout">
        <section className="admin-products-list" aria-label="Lista produktów">
          {filtered.map((product) => (
            <button className={editing?.id === product.id ? 'admin-product-row active' : 'admin-product-row'} key={product.id} type="button" onClick={() => { setNotice(''); setFiles([]); setEditing(toForm(product)); }}>
              <span><strong>{product.name}</strong><small>{product.sku} · {(product.price_grosz / 100).toFixed(2)} zł</small></span>
              <em>{product.status === 'published' ? 'Opublikowany' : product.status === 'draft' ? 'Szkic' : 'Archiwum'}</em>
            </button>
          ))}
          {!filtered.length && <p className="admin-empty">Brak produktów dla wybranych filtrów.</p>}
        </section>

        {editing && (
          <form className="admin-product-form" onSubmit={save}>
            <div className="admin-form-heading"><h2>{editing.id ? 'Edytuj produkt' : 'Nowy produkt'}</h2><button type="button" className="text-button" onClick={() => setEditing(null)}>Zamknij</button></div>
            <div className="admin-form-grid">
              <label>Nazwa<input required value={editing.name} onChange={(event) => { update('name', event.target.value); if (!editing.id) update('slug', makeSlug(event.target.value)); }} /></label>
              <label>SKU<input required value={editing.sku} onChange={(event) => update('sku', event.target.value)} /></label>
              <label>Adres URL<input required pattern="[a-z0-9-]+" value={editing.slug} onChange={(event) => update('slug', makeSlug(event.target.value))} /></label>
              <label>Cena (zł)<input required type="number" step="0.01" min="0" value={(editing.price_grosz / 100).toFixed(2)} onChange={(event) => update('price_grosz', Math.round(Number(event.target.value) * 100))} /></label>
              <label>Kategoria<select value={editing.category_id ?? ''} onChange={(event) => update('category_id', event.target.value || null)}><option value="">Bez kategorii</option>{categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label>Status<select value={editing.status} onChange={(event) => update('status', event.target.value as Status)}><option value="draft">Szkic</option><option value="published">Opublikowany</option><option value="archived">Archiwum</option></select></label>
              <label>Zapach (opcjonalnie)<input value={editing.fragrance ?? ''} onChange={(event) => update('fragrance', event.target.value || null)} /></label>
              <label>Stan magazynowy<input type="number" min="0" value={editing.stock_on_hand} disabled={editing.made_to_order} onChange={(event) => update('stock_on_hand', Number(event.target.value))} /></label>
            </div>
            <label className="admin-checkbox"><input type="checkbox" checked={editing.made_to_order} onChange={(event) => update('made_to_order', event.target.checked)} /> Wykonywany na zamówienie</label>
            <label>Opis<textarea rows={6} value={editing.description} onChange={(event) => update('description', event.target.value)} /></label>
            <div className="admin-form-actions"><button className="btn" disabled={saving} type="submit">{saving ? 'Zapisywanie…' : 'Zapisz produkt'}</button>{notice && <p role="status">{notice}</p>}</div>

            {editing.id && (
              <section className="admin-image-upload">
                <h3>Zdjęcia produktu</h3>
                <p>JPEG, PNG, WebP lub AVIF, maksymalnie 5 MB na plik. Pierwsze zdjęcie jest główne.</p>
                {selected?.product_images?.length ? <p>{selected.product_images.length} przesłanych zdjęć</p> : <p>Brak zdjęć.</p>}
                <input accept="image/jpeg,image/png,image/webp,image/avif" multiple type="file" onChange={(event: ChangeEvent<HTMLInputElement>) => setFiles(Array.from(event.target.files ?? []))} />
                <button className="btn ghost" disabled={uploading || !files.length} onClick={upload} type="button">{uploading ? 'Przesyłanie…' : 'Prześlij zdjęcia'}</button>
              </section>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
