'use client';

import { useState } from 'react';
import { Product } from '@/data/products';
import { useCart } from '@/stores/cart-store';

export function AddToCart({ product }: { product: Product }) {
  const add = useCart((state) => state.add);
  const change = useCart((state) => state.change);
  const items = useCart((state) => state.items);
  const [variantId, setVariantId] = useState(product.variants?.[0]?.id);
  const [notice, setNotice] = useState('');
  const quantity = items.find((item) => item.productId === product.id && item.variantId === variantId)?.quantity ?? 0;

  const addItem = () => {
    add(product.id, variantId);
    setNotice('Dodano do koszyka. Zamówienia będą możliwe po potwierdzeniu dostępności.');
  };

  return (
    <section className="add-to-cart" aria-label="Dodaj produkt do koszyka">
      {product.variants && (
        <fieldset>
          <legend>Wybierz zapach</legend>
          <div className="variant-options">
            {product.variants.map((variant) => (
              <label className={variantId === variant.id ? 'variant-option selected' : 'variant-option'} key={variant.id}>
                <input checked={variantId === variant.id} name="fragrance" onChange={() => setVariantId(variant.id)} type="radio" value={variant.id} />
                {variant.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
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
      <p className="cart-feedback" role="status">{notice || 'Koszyk jest aktywny; finalizacja zamówień wymaga potwierdzenia sprzedaży.'}</p>
    </section>
  );
}
