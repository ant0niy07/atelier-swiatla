import { requireAdmin } from '@/lib/admin-auth';
import { DeliveryManager } from './delivery-manager';
import { AdminBackLink } from '@/components/admin-back-link';
export default async function Delivery(){const {client}=await requireAdmin();const {data}=await client.from('delivery_methods').select('id,label,kind,rate_grosz,active,supports_cod,supports_blik_before_dispatch,description,service_area,available_days,minimum_order_grosz').order('label');return <main className="wrap product-page-dark admin-products-page"><AdminBackLink/><span className="eyebrow">Konfiguracja</span><h1 className="serif">Dostawa</h1><DeliveryManager methods={data??[]}/></main>}
