'use client';
import {create} from 'zustand';
import {persist} from 'zustand/middleware';
type Item={productId:string;variantId?:string;quantity:number};
type Cart={items:Item[];open:boolean;add:(id:string,v?:string)=>void;change:(id:string,v:string|undefined,q:number)=>void;remove:(id:string,v?:string)=>void;setOpen:(open:boolean)=>void};
export const useCart=create<Cart>()(persist((set)=>({items:[],open:false,setOpen:(open)=>set({open}),add:(productId,variantId)=>set(s=>{const i=s.items.find(x=>x.productId===productId&&x.variantId===variantId);return {items:i?s.items.map(x=>x===i?{...x,quantity:x.quantity+1}:x):[...s.items,{productId,variantId,quantity:1}],open:true}}),change:(productId,variantId,quantity)=>set(s=>({items:quantity<1?s.items.filter(x=>!(x.productId===productId&&x.variantId===variantId)):s.items.map(x=>x.productId===productId&&x.variantId===variantId?{...x,quantity}:x)})),remove:(productId,variantId)=>set(s=>({items:s.items.filter(x=>!(x.productId===productId&&x.variantId===variantId))}))}),{name:'atelier-cart'}));
