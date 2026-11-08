export type Promotion={code:string;kind:'percentage'|'fixed'|'free_shipping';value:number;minOrderGrosz:number;maxDiscountGrosz?:number|null;active:boolean;startsAt:string;endsAt?:string|null;eligibleProductIds?:string[];eligibleCategories?:string[];excludedProductIds?:string[]};
export type CartLine={productId:string;category:string;unitGrosz:number;quantity:number};
export type PromotionResult={ok:true;code:string;discountGrosz:number;freeShipping:boolean;eligibleSubtotalGrosz:number}|{ok:false;reason:'invalid'|'expired'|'future'|'disabled'|'minimum'|'empty'};
const money=(n:number)=>Math.max(0,Math.round(n));
export function normalizePromotionCode(code:string){return code.trim().toLocaleUpperCase('pl-PL')}
export function calculatePromotion(p:Promotion|undefined,lines:CartLine[],now=new Date()):PromotionResult{
 if(!p)return {ok:false,reason:'invalid'}; if(!p.active)return {ok:false,reason:'disabled'};
 if(new Date(p.startsAt)>now)return {ok:false,reason:'future'};if(p.endsAt&&new Date(p.endsAt)<=now)return {ok:false,reason:'expired'};
 const subtotal=lines.reduce((s,l)=>s+money(l.unitGrosz)*Math.max(0,Math.floor(l.quantity)),0);if(!subtotal)return {ok:false,reason:'empty'};if(subtotal<p.minOrderGrosz)return {ok:false,reason:'minimum'};
 const eligible=lines.filter(l=>(!p.eligibleProductIds?.length||p.eligibleProductIds.includes(l.productId))&&(!p.eligibleCategories?.length||p.eligibleCategories.includes(l.category))&&!p.excludedProductIds?.includes(l.productId)).reduce((s,l)=>s+money(l.unitGrosz)*Math.max(0,Math.floor(l.quantity)),0);
 if(!eligible)return {ok:false,reason:'empty'};
 if(p.kind==='free_shipping')return {ok:true,code:normalizePromotionCode(p.code),discountGrosz:0,freeShipping:true,eligibleSubtotalGrosz:eligible};
 const raw=p.kind==='percentage'?Math.floor(eligible*p.value/100):p.value;const capped=p.maxDiscountGrosz==null?raw:Math.min(raw,p.maxDiscountGrosz);
 return {ok:true,code:normalizePromotionCode(p.code),discountGrosz:Math.min(eligible,money(capped)),freeShipping:false,eligibleSubtotalGrosz:eligible};
}
