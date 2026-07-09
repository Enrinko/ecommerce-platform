import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth-provider', () => ({ useAuth: () => ({ status: 'guest' }) }));
vi.mock('@/lib/cart', () => ({ useCartMutations: () => ({ add: { mutate: vi.fn() } }) }));

import { useGuestCart } from '@/lib/guest-cart';
import { AddToCart } from './add-to-cart';

const product = {
  id: 'p1',
  slug: 'usb-c-cable',
  title: 'USB-C Cable',
  priceCents: 1900,
  currency: 'USD',
  images: [],
} as never;

afterEach(() => useGuestCart.getState().clear());

describe('AddToCart (guest)', () => {
  it('adds a snapshot line to the guest cart', () => {
    render(<AddToCart product={product} />);
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));
    const items = useGuestCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productId: 'p1', qty: 1, title: 'USB-C Cable' });
  });
});
