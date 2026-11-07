import { createClient } from '@supabase/supabase-js';
import { products as fallbackProducts, Product } from '@/data/products';

export type CatalogProduct = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  price_grosz: number;
  category: { id: string; name: string; slug: string } | null;
  image_url: string | null;
};
export type CatalogCategory = { id: string; name: string; slug: string };

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

function fallback(): CatalogProduct[] {
  return fallbackProducts.map((product: Product) => ({
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    description: product.description,
    price_grosz: product.price,
    category: { id: product.family, slug: product.family, name: product.family === 'glass' ? 'Świece w szkle' : product.family === 'soy' ? 'Świece sojowe' : 'Świece dekoracyjne' },
    image_url: `/cinematic/product-${product.imageTone}.png`,
  }));
}

export async function getPublishedCatalog(): Promise<CatalogProduct[]> {
  const supabase = client();
  if (!supabase) return process.env.NODE_ENV === 'production' ? [] : fallback();

  const { data, error } = await supabase
    .from('products')
    .select('id,slug,sku,name,description,price_grosz,categories(id,name,slug),product_images(storage_path,position)')
    .eq('status', 'published')
    .order('name');
  if (error || !data) return process.env.NODE_ENV === 'production' ? [] : fallback();

  return data.map((product) => {
    const images = [...(product.product_images ?? [])].sort((a, b) => a.position - b.position);
    const image_url = images[0]
      ? supabase.storage.from('product-images').getPublicUrl(images[0].storage_path).data.publicUrl
      : null;
    return {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      description: product.description,
      price_grosz: product.price_grosz,
      category: product.categories?.[0] ?? null,
      image_url,
    };
  });
}

export async function getActiveCategories(): Promise<CatalogCategory[]> {
  const supabase = client();
  if (!supabase) {
    return process.env.NODE_ENV === 'production' ? [] : [
      { id: 'decorative', slug: 'swiece-formowe', name: 'Świece formowe' },
      { id: 'glass', slug: 'swiece-w-szkle', name: 'Świece w szkle' },
      { id: 'gel', slug: 'swiece-zelowe', name: 'Świece żelowe' },
    ];
  }
  const { data, error } = await supabase.from('categories').select('id,name,slug').eq('active', true).order('name');
  return error || !data ? [] : data;
}

export async function getPublishedProduct(slug: string) {
  const catalog = await getPublishedCatalog();
  return catalog.find((product) => product.slug === slug);
}
