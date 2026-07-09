'use client';

import { Price } from '@repo/ui';
import { orderStatusLabel } from '@/lib/orders';

type OrderItem = { titleSnapshot: string; priceCentsSnapshot: number; qty: number };
type Order = { id: string; status: string; totalCents: number; currency: string; items: unknown[] };

export function OrderSummary({ order }: { order: Order }) {
  const items = order.items as OrderItem[];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-graphite">
          Order {order.id.slice(0, 8)}
        </span>
        <span className="rounded-sm border border-hairline px-2 py-1 font-mono text-xs uppercase tracking-widest text-ink">
          {orderStatusLabel(order.status)}
        </span>
      </div>
      <ul className="divide-y divide-hairline border-y border-hairline">
        {items.map((i, idx) => (
          <li key={idx} className="flex items-center justify-between py-3">
            <span className="text-ink">
              {i.titleSnapshot} <span className="text-graphite">× {i.qty}</span>
            </span>
            <Price cents={i.priceCentsSnapshot * i.qty} currency={order.currency} />
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-hairline pt-3">
        <span className="font-mono text-sm uppercase tracking-widest text-graphite">Total</span>
        <Price cents={order.totalCents} currency={order.currency} className="text-lg" />
      </div>
    </div>
  );
}
