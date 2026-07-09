import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product } from '@repo/types';

const mockGuestAdd = jest.fn();
jest.mock('@/lib/guest-cart', () => ({ useGuestCart: () => ({ add: mockGuestAdd }) }));
const mockServerAdd = jest.fn();
jest.mock('@/lib/cart', () => ({ useCartMutations: () => ({ add: { mutate: mockServerAdd } }) }));
let mockStatus = 'guest';
jest.mock('@/components/auth-provider', () => ({ useAuth: () => ({ status: mockStatus }) }));

import { AddToCart } from '@/components/add-to-cart';

const product: Product = {
  id: 'p1',
  title: 'USB-C Cable',
  slug: 'usb-c-cable',
  description: 'd',
  priceCents: 2500,
  currency: 'USD',
  stock: 5,
  images: ['img.png'],
  isActive: true,
  categoryId: 'c1',
  createdAt: new Date('2026-01-01'),
};

beforeEach(() => {
  mockGuestAdd.mockReset();
  mockServerAdd.mockReset();
});

it('adds to the guest cart when not authed', () => {
  mockStatus = 'guest';
  render(<AddToCart product={product} />);
  fireEvent.press(screen.getByText(/add to cart/i));
  expect(mockGuestAdd).toHaveBeenCalledWith(
    expect.objectContaining({ productId: 'p1', slug: 'usb-c-cable', priceCents: 2500 }),
  );
  expect(mockServerAdd).not.toHaveBeenCalled();
});

it('adds to the server cart when authed', () => {
  mockStatus = 'authed';
  render(<AddToCart product={product} />);
  fireEvent.press(screen.getByText(/add to cart/i));
  expect(mockServerAdd).toHaveBeenCalledWith({ productId: 'p1', qty: 1 });
  expect(mockGuestAdd).not.toHaveBeenCalled();
});
