import { requireAdmin } from '@/lib/admin-auth';
import { SettingsEditor } from './settings-editor';
import { AdminBackLink } from '@/components/admin-back-link';
export default async function Settings(){const {client}=await requireAdmin();const {data}=await client.from('store_settings').select('key,value').in('key',['store_contact','store_operations']);return <main className="wrap product-page-dark admin-products-page"><AdminBackLink/><span className="eyebrow">ATELIER ŚWIEC</span><h1 className="serif">Ustawienia</h1><SettingsEditor settings={data??[]}/></main>}
