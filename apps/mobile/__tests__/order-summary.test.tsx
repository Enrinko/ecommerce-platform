import { render, screen } from '@testing-library/react-native';
import type { Order } from '@repo/api-client';
import { OrderSummary } from '@/components/order-summary';

const order: Order = {
  id: 'abcdef12-0000-0000-0000-000000000000',
  status: 'PAID',
  totalCents: 5000,
  currency: 'USD',
  shippingName: 'Ada Lovelace',
  shippingAddr: '1 Analytical Way',
  createdAt: '2026-02-01T00:00:00.000Z',
  items: [
    { id: 'i1', productId: 'p1', titleSnapshot: 'USB-C Cable', priceCentsSnapshot: 2500, qty: 2 },
  ],
};

describe('OrderSummary', () => {
  it('renders status, items, total, and shipping', () => {
    render(<OrderSummary order={order} />);
    expect(screen.getByText('Paid')).toBeTruthy();
    expect(screen.getByText(/USB-C Cable/)).toBeTruthy();
    // line (2×$25) and total are both $50.00 here.
    expect(screen.getAllByText('$50.00').length).toBeGreaterThan(0);
    expect(screen.getByText(/Ada Lovelace/)).toBeTruthy();
  });
});
