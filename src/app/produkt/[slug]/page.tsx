import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCart } from '@/components/AddToCart';
import { formatPrice, getProduct } from '@/data/products';
import { getPublishedProduct } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const product = await getPublishedProduct(slug);
  const staticProduct = getProduct(slug);
  if (!product) notFound();

  return (
    <article className="product-page-dark">
      <div className="wrap product-page">
        <div className="gallery">
          <div className="product-art product-art-large" role="img" aria-label={`Wizualizacja produktu ${product.name}`} style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined}>
            {!product.image_url && <span>Zdjęcie w przygotowaniu</span>}
          </div>
          {product.images.length > 1 && <div className="product-gallery-thumbnails">{product.images.slice(1).map((image) => <a href={image.url} key={image.url} aria-label={image.alt} target="_blank" rel="noreferrer" style={{ backgroundImage: `url(${image.url})` }} />)}</div>}
        </div>
        <section className="product-copy">
          <Link className="back-link" href="/sklep">← Wróć do kolekcji</Link>
          <span className="tag">{product.category?.name ?? 'Kolekcja'}</span>
          <h1 className="serif">{product.name}</h1>
          <p className="product-price">{formatPrice(product.price_grosz)}</p>
          <p className="product-description">{product.description}</p>
          <AddToCart product={{ id: product.id, sku: product.sku, name: product.name, price_grosz: product.price_grosz }} />
          <p className="image-disclaimer">Zdjęcia mają charakter poglądowy. Wygląd produktu może nieznacznie różnić się od przedstawionego na zdjęciu.</p>
          <div className="product-safety">
            <h2 className="serif">Bezpieczeństwo i pielęgnacja</h2>
            <p>Przed użyciem zapoznaj się z etykietą bezpieczeństwa dołączoną do produktu.</p>
            {staticProduct?.family === 'glass' ? (
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
