'use client';

import Link from 'next/link';
import { Price } from '@repo/ui';
import { RequireAuth } from '@/app/_components/require-auth';
import { useMyOrders, orderStatusLabel } from '@/lib/orders';

function OrderList() {
  const { data, isLoading } = useMyOrders();
  if (isLoading) return <p className="text-graphite">Loading…</p>;
  const orders = data?.items ?? [];
  if (orders.length === 0) return <p className="text-graphite">You have no orders yet.</p>;
  return (
    <ul className="divide-y divide-hairline border-y border-hairline">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`/account/orders/${o.id}`}
            className="flex items-center justify-between py-4 hover:text-accent"
          >
            <span className="font-mono text-sm text-graphite">{o.id.slice(0, 8)}</span>
            <span className="font-mono text-xs uppercase tracking-widest text-ink">
              {orderStatusLabel(o.status)}
            </span>
            <Price cents={o.totalCents} currency={o.currency} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Your orders</h1>
        <div className="mt-6">
          <OrderList />
        </div>
      </main>
    </RequireAuth>
  );
}
