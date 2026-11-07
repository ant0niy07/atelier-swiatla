import { requireAdmin } from '@/lib/admin-auth';
import { CategoryManager } from './category-manager';
import { AdminBackLink } from '@/components/admin-back-link';

export default async function CategoriesPage() {
  const { client } = await requireAdmin();
  const [{ data }, { data: publishedProducts }] = await Promise.all([
    client.from('categories').select('id,name,slug,active').order('name'),
    client.from('products').select('category_id').eq('status', 'published'),
  ]);
  const publishedCounts = (publishedProducts ?? []).reduce<Record<string, number>>((counts, product) => {
    if (product.category_id) counts[product.category_id] = (counts[product.category_id] ?? 0) + 1;
    return counts;
  }, {});
  return (
    <main className="wrap product-page-dark admin-products-page">
      <AdminBackLink /><span className="eyebrow">Asortyment</span>
      <h1 className="serif">Kategorie</h1>
      <CategoryManager categories={(data ?? []).map((category) => ({ ...category, publishedCount: publishedCounts[category.id] ?? 0 }))} />
    </main>
  );
}
