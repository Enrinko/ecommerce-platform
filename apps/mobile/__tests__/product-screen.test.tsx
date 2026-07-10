import { render, screen } from '@testing-library/react-native';
import type { ProductDetail, ReviewList } from '@repo/api-client';

let mockParams: Record<string, string> = { slug: 'usb-c-cable' };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

const mockUseProduct = jest.fn();
const mockUseReviews = jest.fn();
jest.mock('@/lib/catalog', () => ({
  useProduct: (...a: unknown[]) => mockUseProduct(...a),
  useReviews: (...a: unknown[]) => mockUseReviews(...a),
}));
// AddToCart pulls in auth/cart context; this screen test only cares about details.
jest.mock('@/components/add-to-cart', () => ({ AddToCart: () => null }));

import ProductScreen from '@/app/(tabs)/shop/[slug]';

const product: ProductDetail = {
  id: 'p1',
  title: 'USB-C Cable',
  slug: 'usb-c-cable',
  description: 'A braided cable',
  priceCents: 2500,
  currency: 'USD',
  stock: 5,
  images: [],
  isActive: true,
  categoryId: 'c1',
  createdAt: new Date('2026-01-01'),
  rating: { avg: 4.5, count: 2 },
} as ProductDetail;

const reviews: ReviewList = {
  items: [{ productId: 'p1', userId: 'u1', rating: 5, title: 'Great', body: 'Works well' }],
  total: 1,
  page: 1,
  limit: 20,
  rating: { avg: 4.5, count: 2 },
};

beforeEach(() => {
  mockParams = { slug: 'usb-c-cable' };
  mockUseProduct.mockReturnValue({ data: product, isLoading: false, isError: false });
  mockUseReviews.mockReturnValue({ data: reviews, isLoading: false, isError: false });
});

it('renders product details, price, rating, and reviews', () => {
  render(<ProductScreen />);
  expect(screen.getByText('USB-C Cable')).toBeTruthy();
  expect(screen.getByText('$25.00')).toBeTruthy();
  expect(screen.getByText(/4\.5/)).toBeTruthy();
  expect(screen.getByText('A braided cable')).toBeTruthy();
  expect(screen.getByText(/Great/)).toBeTruthy();
});

it('shows a not-found state when the product is missing', () => {
  mockUseProduct.mockReturnValue({ data: undefined, isLoading: false, isError: true });
  render(<ProductScreen />);
  expect(screen.getByText(/not found/i)).toBeTruthy();
});
