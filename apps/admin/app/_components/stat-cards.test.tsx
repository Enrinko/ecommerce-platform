import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminStats } from '@repo/types';
import { StatCards } from './stat-cards';

const stats: AdminStats = {
  ordersTotal: 14,
  ordersByStatus: { PENDING: 0, PAID: 8, SHIPPED: 2, DELIVERED: 2, CANCELLED: 2 },
  revenueCents: 19400,
  productCount: 33,
  userCount: 45,
};

describe('StatCards', () => {
  it('renders the headline metrics', () => {
    render(<StatCards stats={stats} />);
    expect(screen.getByText('$194.00')).toBeInTheDocument(); // revenue
    expect(screen.getByText('14')).toBeInTheDocument(); // orders total
    expect(screen.getByText('33')).toBeInTheDocument(); // products
    expect(screen.getByText('45')).toBeInTheDocument(); // customers
  });

  it('shows the per-status breakdown', () => {
    render(<StatCards stats={stats} />);
    expect(screen.getByText(/PAID/)).toBeInTheDocument();
    // 8 PAID appears in the breakdown
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});
