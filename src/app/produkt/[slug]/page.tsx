import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCart } from '@/components/AddToCart';
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
          <AddToCart product={product} />
          <div className="notice"><strong>Sprzedaż wymaga potwierdzenia.</strong> Ceny, dostępność, dostawa i płatności zostaną potwierdzone przed przyjęciem zamówień.</div>
          <p className="image-disclaimer">Zdjęcia mają charakter poglądowy. Wygląd produktu może nieznacznie różnić się od przedstawionego na zdjęciu.</p>
          <div className="product-safety">
            <h2 className="serif">Bezpieczeństwo i pielęgnacja</h2>
            <p>{product.safety}</p>
            {product.family === 'glass' ? (
              <ul className="safety-list">
                <li>Przy pierwszym paleniu pozwól, aby wosk roztopił się równomiernie do krawędzi naczynia.</li>
                <li>Przed każdym użyciem przytnij knot do około 5 mm; nie pal świecy dłużej niż 4 godziny jednorazowo.</li>
                <li>Po zgaszeniu poczekaj, aż wosk i szkło ostygną przed przeniesieniem świecy.</li>
              </ul>
            ) : (
              <ul className="safety-list">
                <li>Ustaw świecę na stabilnej, żaroodpornej podstawce, która zatrzyma spływający wosk.</li>
                <li>Przed zapaleniem przytnij knot do około 5 mm i zachowaj odstęp od innych świec.</li>
                <li>Forma dekoracyjna może zmieniać wygląd podczas palenia — nie pozostawiaj jej bez nadzoru.</li>
              </ul>
            )}
            <ul className="safety-list">
              <li>Nigdy nie pozostawiaj palącej się świecy bez nadzoru; trzymaj ją z dala od dzieci i zwierząt.</li>
              <li>Chroń przed przeciągami i materiałami łatwopalnymi. Nigdy nie gaś świecy wodą.</li>
              <li>Przed pierwszym zapaleniem pozostaw świecę do pełnego utwardzenia zgodnie z informacją na etykiecie.</li>
            </ul>
            <p className="meta">SKU: {product.sku}</p>
          </div>
        </section>
      </div>
    </article>
  );
}
