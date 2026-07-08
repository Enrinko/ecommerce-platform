import { describe, it, expect } from 'vitest';
import { productListQuery } from './product';

describe('productListQuery', () => {
  it('applies defaults', () => {
    expect(productListQuery.parse({})).toEqual({ page: 1, limit: 20, sort: 'newest' });
  });
  it('coerces price bounds and keeps filters', () => {
    const q = productListQuery.parse({ minPriceCents: '1000', category: 'audio', sort: 'price_asc' });
    expect(q.minPriceCents).toBe(1000);
    expect(q.category).toBe('audio');
    expect(q.sort).toBe('price_asc');
  });
  it('rejects an invalid sort', () => {
    expect(() => productListQuery.parse({ sort: 'nope' })).toThrow();
  });
});
