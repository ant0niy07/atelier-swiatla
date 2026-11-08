import { requireAdmin } from '@/lib/admin-auth';
import { PromotionManager } from './promotion-manager';
import { AdminBackLink } from '@/components/admin-back-link';
export default async function Promotions(){const {client}=await requireAdmin();const {data}=await client.from('promotions').select('id,code,kind,value,active,used_count,usage_limit,ends_at,starts_at,min_order_grosz,max_discount_grosz,internal_note').order('created_at',{ascending:false});return <main className="wrap product-page-dark admin-products-page"><AdminBackLink/><span className="eyebrow">Rabaty</span><h1 className="serif">Promocje</h1><PromotionManager promotions={data??[]}/></main>}
