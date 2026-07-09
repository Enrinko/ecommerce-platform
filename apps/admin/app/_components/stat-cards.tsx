'use client';

import type { AdminStats } from '@repo/types';

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-hairline bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-graphite">{label}</div>
      <div className="mt-2 font-mono text-2xl tabular-nums text-ink">{value}</div>
    </div>
  );
}

const STATUS_ORDER = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

export function StatCards({ stats }: { stats: AdminStats }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Revenue (paid orders)" value={money(stats.revenueCents)} />
        <Card label="Orders" value={String(stats.ordersTotal)} />
        <Card label="Products" value={String(stats.productCount)} />
        <Card label="Customers" value={String(stats.userCount)} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {STATUS_ORDER.map((s) => (
          <span
            key={s}
            className="rounded-sm border border-hairline px-2 py-1 font-mono text-graphite"
          >
            {s} <span className="text-ink">{stats.ordersByStatus[s]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
