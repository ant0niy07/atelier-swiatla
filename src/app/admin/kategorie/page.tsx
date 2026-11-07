import { requireAdmin } from '@/lib/admin-auth';
import { CategoryManager } from './category-manager';
import { AdminBackLink } from '@/components/admin-back-link';

export default async function CategoriesPage() {
  const { client } = await requireAdmin();
  const { data } = await client.from('categories').select('id,name,slug,active').order('name');
  return (
    <main className="wrap product-page-dark admin-products-page">
      <AdminBackLink /><span className="eyebrow">Asortyment</span>
      <h1 className="serif">Kategorie</h1>
      <CategoryManager categories={data ?? []} />
    </main>
  );
}
