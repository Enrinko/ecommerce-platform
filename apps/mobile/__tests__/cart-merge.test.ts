import { addCartItem } from '@repo/api-client';

jest.mock('@repo/api-client', () => {
  const actual = jest.requireActual('@repo/api-client');
  return { ...actual, addCartItem: jest.fn().mockResolvedValue({ id: 'c1', items: [] }) };
});

import { useGuestCart } from '@/lib/guest-cart';
import { mergeGuestCartIntoServer } from '@/lib/cart';

const mockAdd = addCartItem as jest.Mock;

beforeEach(() => {
  mockAdd.mockClear();
  useGuestCart.setState({
    items: [
      { productId: 'p1', slug: 's1', title: 'A', priceCents: 100, currency: 'USD', qty: 2 },
      { productId: 'p2', slug: 's2', title: 'B', priceCents: 200, currency: 'USD', qty: 1 },
    ],
  });
});

it('posts each guest line to the server cart and clears it', async () => {
  await mergeGuestCartIntoServer('tok');
  expect(mockAdd).toHaveBeenCalledTimes(2);
  expect(mockAdd).toHaveBeenCalledWith(
    { productId: 'p1', qty: 2 },
    expect.objectContaining({ accessToken: 'tok' }),
  );
  expect(useGuestCart.getState().items).toHaveLength(0);
});
