import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { addCartItem } = vi.hoisted(() => ({ addCartItem: vi.fn() }));
vi.mock('@repo/api-client', async (orig) => {
  const actual = await orig<typeof import('@repo/api-client')>();
  return { ...actual, addCartItem };
});

import { useGuestCart } from './guest-cart';
import { mergeGuestCartIntoServer } from './cart';

beforeEach(() => {
  addCartItem.mockResolvedValue({ id: 'c', items: [] });
  useGuestCart.getState().clear();
});
afterEach(() => {
  addCartItem.mockReset();
  useGuestCart.getState().clear();
});

describe('mergeGuestCartIntoServer', () => {
  it('posts each guest line then clears the local cart', async () => {
    useGuestCart
      .getState()
      .add({ productId: 'p1', slug: 'p-1', title: 'P1', priceCents: 100, currency: 'USD' }, 2);
    useGuestCart
      .getState()
      .add({ productId: 'p2', slug: 'p-2', title: 'P2', priceCents: 200, currency: 'USD' }, 1);

    await mergeGuestCartIntoServer('tok');

    expect(addCartItem).toHaveBeenCalledTimes(2);
    expect(addCartItem).toHaveBeenCalledWith({ productId: 'p1', qty: 2 }, { accessToken: 'tok' });
    expect(useGuestCart.getState().items).toHaveLength(0);
  });

  it('does nothing when the guest cart is empty', async () => {
    await mergeGuestCartIntoServer('tok');
    expect(addCartItem).not.toHaveBeenCalled();
  });
});
