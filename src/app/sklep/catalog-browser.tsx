'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CatalogProduct } from '@/lib/catalog';

function price(value: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value / 100);
}

export function CatalogBrowser({ products }: { products: CatalogProduct[] }) {
  const [category, setCategory] = useState('all');
  const categories = useMemo(() => Array.from(new Map(
    products.filter((product) => product.category).map((product) => [product.category!.id, product.category!]),
  ).values()), [products]);
  const visible = products.filter((product) => category === 'all' || product.category?.id === category);

  return (
    <>
      <div className="filters" aria-label="Filtruj kolekcję">
        <button aria-pressed={category === 'all'} className={category === 'all' ? 'filter selected' : 'filter'} onClick={() => setCategory('all')} type="button">Wszystkie</button>
        {categories.map((item) => <button aria-pressed={category === item.id} className={category === item.id ? 'filter selected' : 'filter'} key={item.id} onClick={() => setCategory(item.id)} type="button">{item.name}</button>)}
      </div>
      <div className="products luxury-products">
        {visible.map((product) => (
          <article className="card" key={product.id}>
            <Link href={`/produkt/${product.slug}`} aria-label={`Poznaj produkt ${product.name}`}>
              <div className="product-art" role="img" aria-label={`Wizualizacja produktu ${product.name}`} style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined}>
                {!product.image_url && <span>Zdjęcie w przygotowaniu</span>}
              </div>
            </Link>
            <span className="tag">{product.category?.name ?? 'Kolekcja'}</span>
            <h3>{product.name}</h3>
            <p className="card-description">{product.description}</p>
            <div className="meta">{price(product.price_grosz)}</div>
            <Link className="btn ghost" href={`/produkt/${product.slug}`}>Poznaj produkt</Link>
          </article>
        ))}
      </div>
      {!visible.length && <p className="catalog-empty">W tej kategorii nie ma jeszcze opublikowanych produktów.</p>}
    </>
  );
}
