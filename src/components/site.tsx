'use client';

import Link from 'next/link';
import { ShoppingBag, X } from 'lucide-react';
import { formatPrice, products, Product } from '@/data/products';
import { useCart } from '@/stores/cart-store';

const artByTone: Record<Product['imageTone'], string> = {
  tree: '/cinematic/product-tree.png',
  ginger: '/cinematic/product-ginger.png',
  amber: '/cinematic/product-amber.png',
  mini: '/cinematic/product-mini.png',
};

export function Header() {
  const count = useCart((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const setOpen = useCart((state) => state.setOpen);

  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link className="brand" href="/" aria-label="ATELIER ŚWIEC — strona główna">
          ATELIER ŚWIEC
        </Link>
        <nav aria-label="Główna nawigacja">
          <Link href="/sklep">Kolekcja</Link>
          <Link href="/kontakt">Kontakt</Link>
        </nav>
        <button className="cart-btn" type="button" onClick={() => setOpen(true)} aria-label="Otwórz koszyk">
          <ShoppingBag aria-hidden="true" size={19} />
          {count > 0 && <span>{count}</span>}
        </button>
      </div>
    </header>
  );
}

export function Cart() {
  const { items, open, setOpen, change, remove } = useCart();
  const lines = items
    .map((item) => ({ item, product: products.find((product) => product.id === item.productId) }))
    .filter((line): line is { item: typeof items[number]; product: Product } => Boolean(line.product));
  const total = lines.reduce((sum, { item, product }) => sum + product.price * item.quantity, 0);

  if (!open) return null;

  return (
    <>
      <button className="overlay" type="button" onClick={() => setOpen(false)} aria-label="Zamknij koszyk" />
      <aside className="drawer" aria-label="Twój koszyk" aria-modal="true" role="dialog">
        <div className="drawer-top">
          <p className="eyebrow">ATELIER ŚWIEC</p>
          <button className="drawer-close" type="button" onClick={() => setOpen(false)} aria-label="Zamknij koszyk">
            <X size={20} />
          </button>
        </div>
        <h2 className="serif">Twój koszyk</h2>
        {lines.length === 0 ? (
          <p className="drawer-empty">Twój koszyk jest pusty.</p>
        ) : (
          <>
            <div className="drawer-lines">
              {lines.map(({ item, product }) => (
                <div className="drawer-item" key={`${product.id}-${item.variantId ?? 'standard'}`}>
                  <div>
                    <strong>{product.name}</strong>
                    <small>{formatPrice(product.price)}</small>
                  </div>
                  <div className="quantity-controls">
                    <button type="button" onClick={() => change(product.id, item.variantId, item.quantity - 1)} aria-label="Zmniejsz ilość">−</button>
                    <span aria-label={`Ilość: ${item.quantity}`}>{item.quantity}</span>
                    <button type="button" onClick={() => change(product.id, item.variantId, item.quantity + 1)} aria-label="Zwiększ ilość">+</button>
                    <button className="remove-line" type="button" onClick={() => remove(product.id, item.variantId)}>Usuń</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="drawer-total"><span>Suma częściowa</span><strong>{formatPrice(total)}</strong></p>
            <Link className="btn drawer-checkout" href="/checkout" onClick={() => setOpen(false)}>Przejdź do podsumowania</Link>
          </>
        )}
      </aside>
    </>
  );
}

export function ProductArt({ product, large = false }: { product: Product; large?: boolean }) {
  return (
    <div
      aria-label={`Wizualizacja koncepcyjna: ${product.name}`}
      className={`product-art ${large ? 'product-art-large' : ''}`}
      role="img"
      style={{ backgroundImage: `url(${artByTone[product.imageTone]})` }}
    >
      <span>Wizualizacja koncepcyjna</span>
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="card">
      <Link href={`/produkt/${product.slug}`} aria-label={`Poznaj produkt ${product.name}`}>
        <ProductArt product={product} />
      </Link>
      <span className="tag">W przygotowaniu</span>
      <h3>{product.name}</h3>
      <p className="card-description">{product.description}</p>
      <div className="meta">{formatPrice(product.price)}</div>
      <Link className="btn ghost" href={`/produkt/${product.slug}`}>Poznaj produkt</Link>
    </article>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <Link className="brand" href="/">ATELIER ŚWIEC</Link>
        <p>Światło dla wyjątkowych zimowych chwil. <Link className="admin-footer-link" href="/admin/login">Panel administracyjny</Link></p>
      </div>
    </footer>
  );
}
