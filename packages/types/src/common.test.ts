import { describe, it, expect } from 'vitest';
import { pageQuery } from './common';

describe('pageQuery', () => {
  it('applies defaults', () => {
    expect(pageQuery.parse({})).toEqual({ page: 1, limit: 20 });
  });
  it('coerces string numbers from query strings', () => {
    expect(pageQuery.parse({ page: '3', limit: '50' })).toEqual({ page: 3, limit: 50 });
  });
  it('rejects a limit above 100', () => {
    expect(() => pageQuery.parse({ limit: '500' })).toThrow();
  });
});
