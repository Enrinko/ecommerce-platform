'use client';

import { AdminShell } from './_components/admin-shell';
import { StatCards } from './_components/stat-cards';
import { OrdersTable } from './_components/orders-table';
import { useAdminStats } from '@/lib/dashboard';
import { useAdminOrders } from '@/lib/orders';

export default function DashboardPage() {
  const stats = useAdminStats();
  const orders = useAdminOrders();
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>

      {stats.isLoading ? (
        <p className="mt-6 text-graphite">Loading metrics…</p>
      ) : stats.isError || !stats.data ? (
        <p className="mt-6 text-accent">Failed to load metrics.</p>
      ) : (
        <StatCards stats={stats.data} />
      )}

      <h2 className="mt-10 font-display text-lg font-semibold text-ink">Recent orders</h2>
      {orders.isLoading ? (
        <p className="mt-4 text-graphite">Loading…</p>
      ) : orders.isError ? (
        <p className="mt-4 text-accent">Failed to load orders.</p>
      ) : (
        <OrdersTable orders={(orders.data?.items ?? []).slice(0, 5)} />
      )}
    </AdminShell>
  );
}
