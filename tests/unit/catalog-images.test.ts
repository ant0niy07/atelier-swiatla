import { describe, expect, it } from 'vitest';
import { localProductImage, resolveCatalogImages } from '@/lib/catalog';

const images: Record<string, string> = {
  'XMAS-TREE-001': '/cinematic/product-swieca-choinka-3d-main.png',
  'XMAS-AMBER-180': '/cinematic/product-winter-amber-main.png',
  'XMAS-MINI-120': '/cinematic/product-winter-mini-main.png',
  'XMAS-GINGER-001': '/cinematic/product-piernikowy-ludzik-main.png',
};

describe('catalog product-image mapping', () => {
  it.each(Object.entries(images))('maps %s to the committed local concept image', (sku, expected) => {
    expect(localProductImage(sku)).toBe(expected);
    expect(resolveCatalogImages(sku, 'Świeca', [])).toMatchObject([{ url: expected }]);
  });

  it('prefers a real Storage image over the local concept fallback', () => {
    expect(resolveCatalogImages('XMAS-AMBER-180', 'Winter Amber', ['https://storage.example/amber.webp']))
      .toMatchObject([{ url: 'https://storage.example/amber.webp' }]);
  });
});
