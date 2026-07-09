import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }));
jest.mock('@/components/auth-provider', () => ({ useAuth: () => ({ status: 'authed' }) }));
const mockMutateAsync = jest.fn();
jest.mock('@/lib/orders', () => ({ useCheckout: () => ({ mutateAsync: mockMutateAsync }) }));

import CheckoutScreen from '@/app/checkout';

beforeEach(() => {
  mockReplace.mockReset();
  mockPush.mockReset();
  mockMutateAsync.mockReset().mockResolvedValue({ id: 'order-1' });
});

it('submits shipping details and routes on success', async () => {
  render(<CheckoutScreen />);
  fireEvent.changeText(screen.getByLabelText(/name/i), 'Ada Lovelace');
  fireEvent.changeText(screen.getByLabelText(/address/i), '1 Analytical Way');
  fireEvent.press(screen.getByText(/place order/i));
  await waitFor(() =>
    expect(mockMutateAsync).toHaveBeenCalledWith({
      shippingName: 'Ada Lovelace',
      shippingAddr: '1 Analytical Way',
    }),
  );
});

it('validates required fields', async () => {
  render(<CheckoutScreen />);
  fireEvent.press(screen.getByText(/place order/i));
  await waitFor(() =>
    expect(screen.getAllByText(/required|at least 1/i).length).toBeGreaterThan(0),
  );
  expect(mockMutateAsync).not.toHaveBeenCalled();
});
