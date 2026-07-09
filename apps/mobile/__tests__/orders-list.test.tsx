import { render, screen, fireEvent } from '@testing-library/react-native';
import { OrdersList } from '@/components/orders-list';

const orders = [
  { id: 'abcdef12-0000-0000-0000-000000000000', status: 'PAID', totalCents: 2500, currency: 'USD' },
];

describe('OrdersList', () => {
  it('renders orders with status + price and opens one', () => {
    const onOpen = jest.fn();
    render(<OrdersList orders={orders} onOpen={onOpen} />);
    expect(screen.getByText('abcdef12')).toBeTruthy();
    expect(screen.getByText('Paid')).toBeTruthy();
    expect(screen.getByText('$25.00')).toBeTruthy();
    fireEvent.press(screen.getByText('abcdef12'));
    expect(onOpen).toHaveBeenCalledWith('abcdef12-0000-0000-0000-000000000000');
  });

  it('shows an empty state', () => {
    render(<OrdersList orders={[]} onOpen={jest.fn()} />);
    expect(screen.getByText(/no orders/i)).toBeTruthy();
  });
});
