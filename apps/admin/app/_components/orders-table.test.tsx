import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Order } from '@repo/api-client';
import { OrdersTable } from './orders-table';

const order: Order = {
  id: 'abcdef12-0000-0000-0000-000000000000',
  status: 'PAID',
  totalCents: 4200,
  currency: 'USD',
  shippingName: 'Ada',
  shippingAddr: '1 Rue',
  createdAt: '2026-02-01T00:00:00.000Z',
  items: [],
  user: { id: 'u1', email: 'ada@x.io' },
};

describe('OrdersTable', () => {
  it('renders a row with customer email and status', () => {
    render(<OrdersTable orders={[order]} />);
    expect(screen.getByText('ada@x.io')).toBeInTheDocument();
    expect(screen.getByText('PAID')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view/i })).toHaveAttribute(
      'href',
      '/orders/abcdef12-0000-0000-0000-000000000000',
    );
  });

  it('shows an empty state', () => {
    render(<OrdersTable orders={[]} />);
    expect(screen.getByText(/no orders/i)).toBeInTheDocument();
  });
});
