'use client';

import Link from 'next/link';
import type { Order } from '@repo/api-client';
import { Price } from '@repo/ui';

const cell = 'px-3 py-2 text-left align-middle';

export function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <p className="mt-6 text-sm text-graphite">No orders yet.</p>;
  }
  return (
    <table className="mt-6 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-hairline text-xs uppercase tracking-wide text-graphite">
          <th className={cell}>Order</th>
          <th className={cell}>Customer</th>
          <th className={cell}>Status</th>
          <th className={cell}>Total</th>
          <th className={cell}>Placed</th>
          <th className={cell}></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id} className="border-b border-hairline">
            <td className={`${cell} font-mono text-xs text-graphite`}>{o.id.slice(0, 8)}</td>
            <td className={cell}>{o.user?.email ?? '—'}</td>
            <td className={cell}>{o.status}</td>
            <td className={cell}>
              <Price cents={o.totalCents} currency={o.currency} />
            </td>
            <td className={cell}>{new Date(o.createdAt).toLocaleDateString()}</td>
            <td className={cell}>
              <Link href={`/orders/${o.id}`} className="text-graphite hover:text-accent">
                View
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
