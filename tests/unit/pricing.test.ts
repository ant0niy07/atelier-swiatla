import {describe,it,expect} from 'vitest'; import {formatPrice,products} from '@/data/products';
describe('catalog',()=>{it('keeps money as integer grosz',()=>expect(products.find(p=>p.id==='amber')?.price).toBe(4490));it('formats PLN',()=>expect(formatPrice(3490)).toContain('34,90'))});
