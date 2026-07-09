'use client';

import { use } from 'react';
import { RequireAuth } from '@/app/_components/require-auth';
import { OrderSummary } from '@/app/_components/order-summary';
import { useOrder } from '@/lib/orders';

function OrderDetail({ id }: { id: string }) {
  const { data: order, isLoading, isError } = useOrder(id);
  if (isLoading) return <p className="text-graphite">Loading…</p>;
  if (isError || !order) return <p className="text-graphite">Order not found.</p>;
  return (
    <>
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Order confirmed</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Thank you</h1>
      <div className="mt-6">
        <OrderSummary order={order} />
      </div>
    </>
  );
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <OrderDetail id={id} />
      </main>
    </RequireAuth>
  );
}
