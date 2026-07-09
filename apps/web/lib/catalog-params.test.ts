import { describe, expect, it } from 'vitest';
import { parseCatalogParams, catalogHref } from './catalog-params';

describe('parseCatalogParams', () => {
  it('applies defaults for empty params', () => {
    expect(parseCatalogParams({})).toMatchObject({ page: 1, limit: 20, sort: 'newest' });
  });
  it('coerces and passes through known params', () => {
    const q = parseCatalogParams({ category: 'audio', page: '2', sort: 'price_asc' });
    expect(q).toMatchObject({ category: 'audio', page: 2, sort: 'price_asc' });
  });
  it('falls back to defaults on invalid input', () => {
    expect(parseCatalogParams({ page: 'abc', sort: 'bogus' })).toMatchObject({
      page: 1,
      sort: 'newest',
    });
  });
});

describe('catalogHref', () => {
  it('builds a query string, skipping undefined', () => {
    expect(catalogHref({ category: 'audio', page: 2, q: undefined })).toBe(
      '/products?category=audio&page=2',
    );
  });
  it('returns bare /products with no params', () => {
    expect(catalogHref({})).toBe('/products');
  });
});
