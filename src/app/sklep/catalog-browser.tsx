'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { CatalogCategory, CatalogProduct } from '@/lib/catalog';
import { useLocale } from '@/components/locale';
import { t } from '@/lib/i18n';
import { localizedProduct } from '@/lib/i18n';

function price(value: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value / 100);
}

export function CatalogBrowser({ products, categories, initialCategorySlug }: { products: CatalogProduct[]; categories: CatalogCategory[]; initialCategorySlug?: string }) {
  const { locale } = useLocale();
  const text = t(locale);
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
        <button aria-pressed={category === 'all'} className={category === 'all' ? 'filter selected' : 'filter'} onClick={() => selectCategory('all')} type="button">{text.all}</button>
        {categories.map((item) => <button aria-pressed={category === item.slug} className={category === item.slug ? 'filter selected' : 'filter'} key={item.id} onClick={() => selectCategory(item.slug)} type="button">{item.name}</button>)}
      </div>
      <div className="products luxury-products">
        {visible.map((product) => (
          <article className="card" key={product.id}>{(() => { const content = localizedProduct(locale, product); return <>
            <Link href={`/produkt/${product.slug}`} aria-label={`${text.discover}: ${content.name}`}>
              <div className="product-art" role="img" aria-label={`Wizualizacja produktu ${content.name}`} style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined}>
                {!product.image_url && <span>Zdjęcie w przygotowaniu</span>}
              </div>
            </Link>
            <span className="tag">{content.category}</span>
            <h3>{content.name}</h3>
            <p className="card-description">{content.description}</p>
            <div className="meta">{price(product.price_grosz)}</div>
            <Link className="btn ghost" href={`/produkt/${product.slug}`}>{text.discover}</Link>
          </>})()}</article>
        ))}
      </div>
      {!visible.length && category !== 'all' && <section className="catalog-empty"><h2>{text.emptyTitle}</h2><p>{text.emptyBody}</p><button className="btn ghost" onClick={() => selectCategory('all')} type="button">{text.otherCandles}</button></section>}
    </>
  );
}
