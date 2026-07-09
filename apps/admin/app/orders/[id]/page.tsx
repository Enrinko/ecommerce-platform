'use client';

import { useParams } from 'next/navigation';
import { ApiError } from '@repo/api-client';
import type { OrderStatusValue } from '@repo/types';
import { Price } from '@repo/ui';
import { AdminShell } from '../../_components/admin-shell';
import { OrderStatusControl } from '../../_components/order-status-control';
import { useAdminOrder, useOrderStatusMutation } from '@/lib/orders';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const order = useAdminOrder(id);
  const statusM = useOrderStatusMutation(id);

  if (order.isLoading) {
    return (
      <AdminShell>
        <p className="text-graphite">Loading…</p>
      </AdminShell>
    );
  }
  if (order.isError || !order.data) {
    return (
      <AdminShell>
        <p className="text-accent">Order not found.</p>
      </AdminShell>
    );
  }
  const o = order.data;
  const statusError =
    statusM.error instanceof ApiError && statusM.error.status === 409
      ? 'That status change isn’t allowed for this order anymore.'
      : statusM.isError
        ? 'Could not update status.'
        : null;

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">
        Order <span className="font-mono text-lg text-graphite">{o.id.slice(0, 8)}</span>
      </h1>
      <dl className="mt-4 grid max-w-lg grid-cols-2 gap-1 text-sm">
        <dt className="text-graphite">Customer</dt>
        <dd className="text-ink">{o.user?.email ?? '—'}</dd>
        <dt className="text-graphite">Status</dt>
        <dd className="text-ink">{o.status}</dd>
        <dt className="text-graphite">Total</dt>
        <dd>
          <Price cents={o.totalCents} currency={o.currency} />
        </dd>
        <dt className="text-graphite">Ship to</dt>
        <dd className="text-ink">
          {o.shippingName}, {o.shippingAddr}
        </dd>
      </dl>

      <table className="mt-6 w-full max-w-lg border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline text-xs uppercase tracking-wide text-graphite">
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-left">Qty</th>
            <th className="px-3 py-2 text-left">Price</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((it) => (
            <tr key={it.id} className="border-b border-hairline">
              <td className="px-3 py-2">{it.titleSnapshot}</td>
              <td className="px-3 py-2">{it.qty}</td>
              <td className="px-3 py-2">
                <Price cents={it.priceCentsSnapshot} currency={o.currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6">
        <OrderStatusControl
          status={o.status as OrderStatusValue}
          pending={statusM.isPending}
          error={statusError}
          onChange={(next) => statusM.mutate(next)}
        />
      </div>
    </AdminShell>
  );
}
