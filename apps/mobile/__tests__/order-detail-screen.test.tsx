import { render, screen } from '@testing-library/react-native';
import type { Order } from '@repo/api-client';

let mockParams: Record<string, string> = { id: 'order-1' };
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('@/components/require-auth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => children,
}));
const mockUseOrder = jest.fn();
jest.mock('@/lib/orders', () => ({
  useOrder: (...a: unknown[]) => mockUseOrder(...a),
  orderStatusLabel: (s: string) => s,
}));

import OrderDetailScreen from '@/app/orders/[id]';

const order: Order = {
  id: 'order-1',
  status: 'PAID',
  totalCents: 2500,
  currency: 'USD',
  shippingName: 'Ada',
  shippingAddr: '1 Way',
  createdAt: '2026-02-01T00:00:00.000Z',
  items: [
    { id: 'i1', productId: 'p1', titleSnapshot: 'USB-C Cable', priceCentsSnapshot: 2500, qty: 1 },
  ],
};

beforeEach(() => {
  mockParams = { id: 'order-1' };
});

it('renders the order summary', () => {
  mockUseOrder.mockReturnValue({ data: order, isLoading: false, isError: false });
  render(<OrderDetailScreen />);
  expect(screen.getByText(/USB-C Cable/)).toBeTruthy();
  expect(screen.getAllByText('$25.00').length).toBeGreaterThan(0);
});

it('shows a not-found state', () => {
  mockUseOrder.mockReturnValue({ data: undefined, isLoading: false, isError: true });
  render(<OrderDetailScreen />);
  expect(screen.getByText(/not found/i)).toBeTruthy();
});
