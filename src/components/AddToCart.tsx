'use client';

import { useState } from 'react';
import { CartProduct, useCart } from '@/stores/cart-store';

export function AddToCart({ product }: { product: CartProduct }) {
  const add = useCart((state) => state.add);
  const change = useCart((state) => state.change);
  const items = useCart((state) => state.items);
  const [variantId] = useState(product.variantId);
  const [notice, setNotice] = useState('');
  const quantity = items.find((item) => item.productId === product.id && item.variantId === variantId)?.quantity ?? 0;

  const addItem = () => {
    add({ ...product, variantId });
    setNotice('Dodano do koszyka.');
  };

  return (
    <section className="add-to-cart" aria-label="Dodaj produkt do koszyka">
      <div className="add-row">
        {quantity > 0 && (
          <div className="inline-quantity" aria-label="Ilość w koszyku">
            <button aria-label="Zmniejsz ilość" onClick={() => change(product.id, variantId, quantity - 1)} type="button">−</button>
            <span>{quantity}</span>
            <button aria-label="Zwiększ ilość" onClick={addItem} type="button">+</button>
          </div>
        )}
        <button className="btn" onClick={addItem} type="button">Dodaj do koszyka</button>
      </div>
      <p className="cart-feedback" role="status">{notice}</p>
    </section>
  );
}
