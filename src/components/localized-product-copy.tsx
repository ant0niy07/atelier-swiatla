'use client';

import { useLocale } from '@/components/locale';
import { localizedProduct } from '@/lib/i18n';

export function LocalizedProductCopy({ product }: { product: { sku: string; name: string; description: string; category: { name: string } | null } }) {
  const { locale } = useLocale();
  const content = localizedProduct(locale, product);
  return <><span className="tag">{content.category}</span><h1 className="serif">{content.name}</h1><p className="product-description">{content.description}</p></>;
}
