import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductArt } from '@/components/site';
import { formatPrice, getProduct } from '@/data/products';

export function generateStaticParams() {
  return ['swieca-choinka-3d', 'piernikowy-ludzik', 'winter-amber', 'winter-mini'].map((slug) => ({ slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = getProduct((await params).slug);
  if (!product) notFound();

  return (
    <article className="product-page-dark">
      <div className="wrap product-page">
        <div className="gallery"><ProductArt large product={product} /></div>
        <section className="product-copy">
          <Link className="back-link" href="/sklep">← Wróć do kolekcji</Link>
          <span className="tag">Kolekcja w przygotowaniu</span>
          <h1 className="serif">{product.name}</h1>
          <p className="product-price">{formatPrice(product.price)}</p>
          <p className="product-description">{product.description}</p>
          {product.variants && (
            <>
              <p className="eyebrow">Planowane warianty zapachowe</p>
              <div className="variants">
                {product.variants.map((variant) => <button className="filter" disabled key={variant.id}>{variant.name}</button>)}
              </div>
            </>
          )}
          <div className="notice"><strong>Produkt podglądowy.</strong> Nie jest jeszcze dostępny do zakupu. Cena ma charakter orientacyjny, a parametry finalnej świecy zostaną potwierdzone po testach.</div>
          <button className="btn" disabled type="button">Sprzedaż wkrótce</button>
          <div className="product-safety">
            <h2 className="serif">Bezpieczeństwo i pielęgnacja</h2>
            <p>{product.safety}</p>
            <p className="meta">SKU: {product.sku}</p>
          </div>
        </section>
      </div>
    </article>
  );
}
