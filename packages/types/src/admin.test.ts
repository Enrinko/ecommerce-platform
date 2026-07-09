import { describe, it, expect } from 'vitest';
import { adminStats, userListItem } from './admin';
import { nextStatuses } from './order';

describe('admin contracts', () => {
  it('parses a user list item', () => {
    const v = userListItem.parse({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'a@b.io',
      role: 'ADMIN',
      createdAt: '2026-01-01T00:00:00Z',
      orderCount: 3,
    });
    expect(v.orderCount).toBe(3);
    expect(v.createdAt).toBeInstanceOf(Date);
  });

  it('parses admin stats with every status bucket', () => {
    const v = adminStats.parse({
      ordersTotal: 5,
      ordersByStatus: { PENDING: 1, PAID: 2, SHIPPED: 1, DELIVERED: 1, CANCELLED: 0 },
      revenueCents: 999,
      productCount: 10,
      userCount: 4,
    });
    expect(v.revenueCents).toBe(999);
  });

  it('rejects stats missing a status bucket', () => {
    expect(() =>
      adminStats.parse({
        ordersTotal: 0,
        ordersByStatus: { PENDING: 0 },
        revenueCents: 0,
        productCount: 0,
        userCount: 0,
      }),
    ).toThrow();
  });
});

describe('order transitions', () => {
  it('lists valid next statuses', () => {
    expect(nextStatuses('PAID')).toEqual(['SHIPPED', 'CANCELLED']);
    expect(nextStatuses('DELIVERED')).toEqual([]);
  });
});
