import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { OrderEditor } from './order-editor';

export default async function Order({ params }: { params: Promise<{ id: string }> }) {
  const { client } = await requireAdmin();
  const { id } = await params;
  const { data: order } = await client.from('orders')
    .select('*,order_items(*),customers(first_name,last_name,phone),order_status_history(status,note,created_at)')
    .eq('id', id).maybeSingle();
  if (!order) notFound();
  return <main className="wrap product-page-dark admin-order-page"><span className="eyebrow">Zamówienie #{order.order_number}</span><h1 className="serif">Szczegóły zamówienia</h1><OrderEditor order={order} /></main>;
}
