import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';

export default async function AdminPage() {
  const { client } = await requireAdmin();
  const { count: newOrders } = await client.from('orders').select('*', { count: 'exact', head: true }).eq('fulfillment_status', 'new').eq('is_test', false);
  return <main className="wrap product-page-dark"><section><span className="eyebrow">ATELIER ŚWIEC</span><h1 className="serif">Panel administracyjny</h1><p>Nowe zamówienia: {newOrders ?? 0}</p><nav><Link href="/admin/zamowienia">Zamówienia</Link> · <Link href="/admin/produkcja">Produkcja</Link> · <Link href="/admin/produkty">Produkty</Link> · <Link href="/admin/dostawa">Dostawa</Link> · <Link href="/admin/promocje">Promocje</Link></nav></section></main>;
}
