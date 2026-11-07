import { CatalogBrowser } from './catalog-browser';
import { getActiveCategories, getPublishedCatalog } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ kategoria?: string }> }) {
  const [products, categories, query] = await Promise.all([getPublishedCatalog(), getActiveCategories(), searchParams]);

  return (
    <section className="shop-dark">
      <div className="shop-bg" aria-hidden="true" />
      <div className="wrap shop-content">
        <header className="catalog-head">
          <span className="eyebrow">ATELIER ŚWIEC</span>
          <h1 className="serif">Kolekcja świąteczna</h1>
          <p>Świece tworzone z myślą o wyjątkowych chwilach.</p>
          <small>Produkty wykonywane są z dbałością o każdy detal.</small>
        </header>
        <CatalogBrowser categories={categories} initialCategorySlug={query.kategoria} products={products} />
      </div>
    </section>
  );
}
