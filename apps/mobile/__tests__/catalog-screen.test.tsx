import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product } from '@repo/types';

const mockSetParams = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: mockSetParams, push: mockPush }),
}));

const mockUseProducts = jest.fn();
const mockUseCategories = jest.fn();
jest.mock('@/lib/catalog', () => ({
  useProducts: (...a: unknown[]) => mockUseProducts(...a),
  useCategories: (...a: unknown[]) => mockUseCategories(...a),
}));

import ShopScreen from '@/app/(tabs)/shop/index';

const product: Product = {
  id: 'p1',
  title: 'USB-C Cable',
  slug: 'usb-c-cable',
  description: 'd',
  priceCents: 2500,
  currency: 'USD',
  stock: 5,
  images: [],
  isActive: true,
  categoryId: 'c1',
  category: { id: 'c1', name: 'Cables', slug: 'cables' },
  createdAt: new Date('2026-01-01'),
};

beforeEach(() => {
  mockParams = {};
  mockSetParams.mockReset();
  mockPush.mockReset();
  mockUseCategories.mockReturnValue({ data: [{ id: 'c1', name: 'Cables', slug: 'cables' }] });
  mockUseProducts.mockReturnValue({
    data: { items: [product], total: 1, page: 1, limit: 20 },
    isLoading: false,
    isError: false,
  });
});

it('lists products and navigates to a product on tap', () => {
  render(<ShopScreen />);
  expect(screen.getByText('USB-C Cable')).toBeTruthy();
  fireEvent.press(screen.getByText('USB-C Cable'));
  expect(mockPush).toHaveBeenCalledWith('/shop/usb-c-cable');
});

it('shows an empty state when there are no products', () => {
  mockUseProducts.mockReturnValue({
    data: { items: [], total: 0, page: 1, limit: 20 },
    isLoading: false,
    isError: false,
  });
  render(<ShopScreen />);
  expect(screen.getByText(/no products/i)).toBeTruthy();
});
