import { beforeEach, describe, expect, it } from 'vitest';
import { useGuestCart } from './guest-cart';

const base = { productId: 'p1', slug: 'p-1', title: 'P1', priceCents: 1000, currency: 'USD' };

beforeEach(() => useGuestCart.getState().clear());

describe('guest cart', () => {
  it('adds a new line with default qty 1', () => {
    useGuestCart.getState().add(base);
    expect(useGuestCart.getState().items).toEqual([{ ...base, qty: 1 }]);
  });
  it('accumulates qty when adding the same product', () => {
    useGuestCart.getState().add(base, 2);
    useGuestCart.getState().add(base, 3);
    expect(useGuestCart.getState().items[0].qty).toBe(5);
  });
  it('setQty to 0 removes the line', () => {
    useGuestCart.getState().add(base, 2);
    useGuestCart.getState().setQty('p1', 0);
    expect(useGuestCart.getState().items).toHaveLength(0);
  });
  it('remove drops the line; clear empties', () => {
    useGuestCart.getState().add(base);
    useGuestCart.getState().remove('p1');
    expect(useGuestCart.getState().items).toHaveLength(0);
  });
});
