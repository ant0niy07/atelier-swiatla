import { requireAdmin } from '@/lib/admin-auth';
import { ProductManager } from './product-manager';
import { AdminBackLink } from '@/components/admin-back-link';

export default async function Products() {
  const { client } = await requireAdmin();
  const [{ data: products }, { data: categories }] = await Promise.all([
    client.from('products').select('id,name,slug,sku,description,price_grosz,stock_on_hand,made_to_order,status,category_id,fragrance,product_images(id,storage_path,position)').order('name'),
    client.from('categories').select('id,name,slug,active').order('name'),
  ]);

  return (
    <main className="wrap product-page-dark admin-products-page">
      <AdminBackLink /><span className="eyebrow">Asortyment</span>
      <h1 className="serif">Produkty</h1>
      <ProductManager products={products ?? []} categories={categories ?? []} />
    </main>
  );
}
