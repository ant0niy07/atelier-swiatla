import { CatalogBrowser } from './catalog-browser';
import { getPublishedCatalog } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function ShopPage() {
  const products = await getPublishedCatalog();

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
        <CatalogBrowser products={products} />
      </div>
    </section>
  );
}
