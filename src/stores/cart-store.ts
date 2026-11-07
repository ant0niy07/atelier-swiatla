'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export type CartProduct={id:string;sku:string;name:string;price_grosz:number;variantId?:string;variantName?:string};
type Item=CartProduct&{productId:string;quantity:number};
type Cart={items:Item[];open:boolean;add:(product:CartProduct)=>void;change:(id:string,v:string|undefined,q:number)=>void;remove:(id:string,v?:string)=>void;setOpen:(open:boolean)=>void;clear:()=>void};
export const useCart = create<Cart>()(persist(
  (set) => ({
    items: [], open: false,
    setOpen: (open) => set({ open }),
    clear: () => set({ items: [] }),
    add: (product) => set((state) => {
      const existing = state.items.find((item) => item.productId === product.id && item.variantId === product.variantId);
      return { items: existing ? state.items.map((item) => item === existing ? { ...item, quantity: item.quantity + 1 } : item) : [...state.items, { productId: product.id, ...product, quantity: 1 }], open: true };
    }),
    change: (productId, variantId, quantity) => set((state) => ({ items: quantity < 1 ? state.items.filter((item) => !(item.productId === productId && item.variantId === variantId)) : state.items.map((item) => item.productId === productId && item.variantId === variantId ? { ...item, quantity } : item) })),
    remove: (productId, variantId) => set((state) => ({ items: state.items.filter((item) => !(item.productId === productId && item.variantId === variantId)) })),
  }),
  { name: 'atelier-cart', version: 2, migrate: (old) => {
    const state = old as { items?: unknown[] };
    return { items: (state.items ?? []).filter((item): item is Item => Boolean((item as Item).sku && (item as Item).price_grosz)), open: false };
  } },
));
