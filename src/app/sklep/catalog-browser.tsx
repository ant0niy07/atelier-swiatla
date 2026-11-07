'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { CatalogCategory, CatalogProduct } from '@/lib/catalog';

function price(value: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value / 100);
}

export function CatalogBrowser({ products, categories, initialCategorySlug }: { products: CatalogProduct[]; categories: CatalogCategory[]; initialCategorySlug?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedCategory = searchParams.get('kategoria') ?? initialCategorySlug;
  const category = categories.some((item) => item.slug === requestedCategory) ? requestedCategory! : 'all';
  const visible = products.filter((product) => category === 'all' || product.category?.slug === category);
  function selectCategory(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (slug === 'all') params.delete('kategoria'); else params.set('kategoria', slug);
    router.push(params.size ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <>
      <div className="filters" aria-label="Filtruj kolekcję">
        <button aria-pressed={category === 'all'} className={category === 'all' ? 'filter selected' : 'filter'} onClick={() => selectCategory('all')} type="button">Wszystkie</button>
        {categories.map((item) => <button aria-pressed={category === item.slug} className={category === item.slug ? 'filter selected' : 'filter'} key={item.id} onClick={() => selectCategory(item.slug)} type="button">{item.name}</button>)}
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
      {!visible.length && category !== 'all' && <section className="catalog-empty"><h2>Ups! Na razie nic tu nie ma.</h2><p>Pracujemy nad nowymi produktami. Zajrzyj do nas ponownie!</p><button className="btn ghost" onClick={() => selectCategory('all')} type="button">Zobacz pozostałe świece</button></section>}
    </>
  );
}
