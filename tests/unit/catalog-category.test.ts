import { describe, expect, it } from 'vitest';
import { mapCatalogCategory } from '@/lib/catalog';

describe('catalog category relationship', () => {
  it('maps Supabase many-to-one objects without dropping the category', () => {
    expect(mapCatalogCategory({ id: 'form', name: 'Świece formowe', slug: 'swiece-formowe' })).toMatchObject({ slug: 'swiece-formowe' });
  });

  it('still tolerates an array relationship response', () => {
    expect(mapCatalogCategory([{ id: 'glass', name: 'Świece w szkle', slug: 'swiece-w-szkle' }])).toMatchObject({ slug: 'swiece-w-szkle' });
  });
});
