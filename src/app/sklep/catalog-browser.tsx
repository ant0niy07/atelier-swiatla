'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CatalogCategory, CatalogProduct } from '@/lib/catalog';

function price(value: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value / 100);
}

export function CatalogBrowser({ products, categories, initialCategorySlug }: { products: CatalogProduct[]; categories: CatalogCategory[]; initialCategorySlug?: string }) {
  const initial = categories.some((item) => item.slug === initialCategorySlug) ? initialCategorySlug! : 'all';
  const [category, setCategory] = useState(initial);
  const visible = products.filter((product) => category === 'all' || product.category?.slug === category);

  return (
    <>
      <div className="filters" aria-label="Filtruj kolekcję">
        <button aria-pressed={category === 'all'} className={category === 'all' ? 'filter selected' : 'filter'} onClick={() => setCategory('all')} type="button">Wszystkie</button>
        {categories.map((item) => <button aria-pressed={category === item.slug} className={category === item.slug ? 'filter selected' : 'filter'} key={item.id} onClick={() => setCategory(item.slug)} type="button">{item.name}</button>)}
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
      {!visible.length && category !== 'all' && <section className="catalog-empty"><h2>Już wkrótce coś wyjątkowego!</h2><p>W tej kategorii nie ma jeszcze dostępnych produktów. Pracujemy nad nową kolekcją. Zajrzyj do nas ponownie!</p><button className="btn ghost" onClick={() => setCategory('all')} type="button">Zobacz pozostałe świece</button></section>}
    </>
  );
}
