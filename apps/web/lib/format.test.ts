import { describe, expect, it } from 'vitest';
import { formatPrice, formatCount } from './format';

describe('formatPrice', () => {
  it('renders cents as major units with a currency symbol', () => {
    expect(formatPrice(1900, 'USD')).toBe('$19.00');
    expect(formatPrice(150, 'EUR')).toBe('€1.50');
  });
});

describe('formatCount', () => {
  it('pluralizes the noun', () => {
    expect(formatCount(1, 'review')).toBe('1 review');
    expect(formatCount(3, 'review')).toBe('3 reviews');
    expect(formatCount(0, 'review')).toBe('No reviews');
  });
});
