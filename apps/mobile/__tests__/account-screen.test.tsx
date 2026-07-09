import { render, screen, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
const mockLogout = jest.fn();
jest.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ status: 'authed', user: { email: 'buyer@example.com' }, logout: mockLogout }),
}));
jest.mock('@/components/require-auth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => children,
}));
const mockUseMyOrders = jest.fn();
jest.mock('@/lib/orders', () => ({
  useMyOrders: (...a: unknown[]) => mockUseMyOrders(...a),
  orderStatusLabel: (s: string) => s,
}));

import AccountScreen from '@/app/(tabs)/account/index';

beforeEach(() => {
  mockPush.mockReset();
  mockLogout.mockReset();
  mockUseMyOrders.mockReturnValue({
    data: {
      items: [{ id: 'order-1234-5678', status: 'PAID', totalCents: 2500, currency: 'USD' }],
      total: 1,
      page: 1,
      limit: 20,
    },
    isLoading: false,
  });
});

it('shows the email, orders, and opens an order', () => {
  render(<AccountScreen />);
  expect(screen.getByText('buyer@example.com')).toBeTruthy();
  fireEvent.press(screen.getByText('order-12'));
  expect(mockPush).toHaveBeenCalledWith('/orders/order-1234-5678');
});

it('logs out', () => {
  render(<AccountScreen />);
  fireEvent.press(screen.getByText(/log out/i));
  expect(mockLogout).toHaveBeenCalled();
});
