'use client';

import { useState } from 'react';
import { ProductCard } from '@/components/site';
import { products } from '@/data/products';

const filters = [
  ['all', 'Wszystkie'],
  ['decorative', 'Świece dekoracyjne'],
  ['glass', 'Świece w szkle'],
  ['soy', 'Świece sojowe'],
] as const;

export default function ShopPage() {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const visibleProducts = products.filter((product) => activeFilter === 'all' || product.family === activeFilter);

  return (
    <section className="shop-dark">
      <div className="shop-bg" aria-hidden="true" />
      <div className="wrap shop-content">
        <header className="catalog-head">
          <span className="eyebrow">ATELIER ŚWIEC</span>
          <h1 className="serif">Kolekcja świąteczna</h1>
          <p>Świece tworzone z myślą o wyjątkowych chwilach.</p>
          <small>Sprzedaż wkrótce.</small>
        </header>
        <div className="filters" aria-label="Filtruj kolekcję">
          {filters.map(([id, label]) => (
            <button
              aria-pressed={activeFilter === id}
              className={`filter ${activeFilter === id ? 'selected' : ''}`}
              key={id}
              onClick={() => setActiveFilter(id)}
              type="button"
            >
              {label}
            </button>
          ))}
          <button className="filter" disabled type="button">Świece żelowe · wkrótce</button>
        </div>
        <div className="products luxury-products">
          {visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  );
}
