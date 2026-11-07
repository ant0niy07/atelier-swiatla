'use client';

import Link from 'next/link';
import { Menu, ShoppingBag, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatPrice, products, Product } from '@/data/products';
import { useCart } from '@/stores/cart-store';
import { LanguageSwitch, useLocale } from '@/components/locale';

const artByTone: Record<Product['imageTone'], string> = {
  tree: '/cinematic/product-tree.png',
  ginger: '/cinematic/product-ginger.png',
  amber: '/cinematic/product-amber.png',
  mini: '/cinematic/product-mini.png',
};

export function Header() {
  const { locale } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const count = useCart((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const setOpen = useCart((state) => state.setOpen);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link className="brand" href="/" aria-label="ATELIER ŚWIEC — strona główna" onClick={() => setMenuOpen(false)}>
          ATELIER ŚWIEC
        </Link>
        <nav className="desktop-nav" aria-label={locale === 'ru' ? 'Основная навигация' : 'Główna nawigacja'}>
          <Link href="/sklep">{locale === 'ru' ? 'Коллекция' : 'Kolekcja'}</Link>
          <Link href="/kontakt">{locale === 'ru' ? 'Контакты' : 'Kontakt'}</Link>
        </nav>
        <div className="header-actions">
          <div className="desktop-language"><LanguageSwitch /></div>
          <button className="cart-btn" type="button" onClick={() => { setMenuOpen(false); setOpen(true); }} aria-label={locale === 'ru' ? 'Открыть корзину' : 'Otwórz koszyk'}>
            <ShoppingBag aria-hidden="true" size={19} />
            {count > 0 && <span className="cart-count">{count}</span>}
          </button>
          <button
            className="mobile-menu-trigger"
            type="button"
            aria-label={locale === 'ru' ? 'Открыть меню' : 'Otwórz menu'}
            aria-expanded={menuOpen}
            aria-controls="atelier-mobile-navigation"
            onClick={() => setMenuOpen((current) => !current)}
          >
            <Menu aria-hidden="true" size={22} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <>
          <button className="mobile-menu-backdrop" type="button" onClick={() => setMenuOpen(false)} aria-label={locale === 'ru' ? 'Закрыть меню' : 'Zamknij menu'} />
          <nav className="mobile-nav" id="atelier-mobile-navigation" aria-label={locale === 'ru' ? 'Мобильное меню' : 'Menu mobilne'}>
            <div className="mobile-nav-top">
              <span className="eyebrow">ATELIER ŚWIEC</span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label={locale === 'ru' ? 'Закрыть меню' : 'Zamknij menu'}><X size={22} aria-hidden="true" /></button>
            </div>
            <Link href="/" onClick={() => setMenuOpen(false)}>{locale === 'ru' ? 'Главная' : 'Strona główna'}</Link>
            <Link href="/sklep" onClick={() => setMenuOpen(false)}>{locale === 'ru' ? 'Коллекция' : 'Kolekcja'}</Link>
            <Link href="/kontakt" onClick={() => setMenuOpen(false)}>{locale === 'ru' ? 'Контакты' : 'Kontakt'}</Link>
            <div className="mobile-nav-language"><span className="eyebrow">{locale === 'ru' ? 'Язык' : 'Język'}</span><LanguageSwitch /></div>
          </nav>
        </>
      )}
    </header>
  );
}

export function Cart() {
  const {locale}=useLocale();
  const { items, open, setOpen, change, remove } = useCart();
  const lines = items
    .map((item) => ({ item, product: products.find((product) => product.id === item.productId) }))
    .filter((line): line is { item: typeof items[number]; product: Product } => Boolean(line.product));
  const total = lines.reduce((sum, { item, product }) => sum + product.price * item.quantity, 0);

  if (!open) return null;

  return (
    <>
      <button className="overlay" type="button" onClick={() => setOpen(false)} aria-label={locale==='ru'?'Закрыть корзину':'Zamknij koszyk'} />
      <aside className="drawer" aria-label="Twój koszyk" aria-modal="true" role="dialog">
        <div className="drawer-top">
          <p className="eyebrow">ATELIER ŚWIEC</p>
          <button className="drawer-close" type="button" onClick={() => setOpen(false)} aria-label="Zamknij koszyk">
            <X size={20} />
          </button>
        </div>
        <h2 className="serif">{locale==='ru'?'Корзина':'Twój koszyk'}</h2>
        {lines.length === 0 ? (
          <p className="drawer-empty">{locale==='ru'?'Ваша корзина пуста.':'Twój koszyk jest pusty.'}</p>
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
                    <button className="remove-line" type="button" onClick={() => remove(product.id, item.variantId)}>{locale==='ru'?'Удалить':'Usuń'}</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="drawer-total"><span>{locale==='ru'?'Сумма товаров':'Suma częściowa'}</span><strong>{formatPrice(total)}</strong></p>
            <Link className="btn drawer-checkout" href="/checkout" onClick={() => setOpen(false)}>{locale==='ru'?'Перейти к оформлению':'Przejdź do podsumowania'}</Link>
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
  const {locale}=useLocale();
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <Link className="brand" href="/">ATELIER ŚWIEC</Link>
        <p>{locale==='ru'?'Свет для особенных зимних мгновений.':'Światło dla wyjątkowych zimowych chwil.'}</p>
        <p className="footer-copyright"><Link href="/admin/login" aria-label={locale==='ru'?'Вход в администрирование':'Wejście do panelu administracyjnego'}>©</Link> 2026 ATELIER ŚWIEC</p>
      </div>
    </footer>
  );
}
