'use client';

import { AdminShell } from '../_components/admin-shell';
import { OrdersTable } from '../_components/orders-table';
import { useAdminOrders } from '@/lib/orders';

export default function OrdersPage() {
  const orders = useAdminOrders();
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">Orders</h1>
      {orders.isLoading ? (
        <p className="mt-6 text-graphite">Loading…</p>
      ) : orders.isError ? (
        <p className="mt-6 text-accent">Failed to load orders.</p>
      ) : (
        <OrdersTable orders={orders.data?.items ?? []} />
      )}
    </AdminShell>
  );
}
