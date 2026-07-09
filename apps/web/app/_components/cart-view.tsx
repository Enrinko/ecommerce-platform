'use client';

import { Price } from '@repo/ui';
import { useAuth } from './auth-provider';
import { useGuestCart } from '@/lib/guest-cart';
import { useServerCart, useCartMutations } from '@/lib/cart';

type Line = { productId: string; title: string; priceCents: number; currency: string; qty: number };

export function CartView() {
  const { status } = useAuth();
  const guest = useGuestCart();
  const server = useServerCart(status === 'authed');
  const mut = useCartMutations();

  const lines: Line[] =
    status === 'authed'
      ? (server.data?.items ?? []).map((i) => {
          const p = i.product as { title: string; priceCents: number; currency: string };
          return {
            productId: i.productId,
            title: p.title,
            priceCents: p.priceCents,
            currency: p.currency,
            qty: i.qty,
          };
        })
      : guest.items.map((i) => ({
          productId: i.productId,
          title: i.title,
          priceCents: i.priceCents,
          currency: i.currency,
          qty: i.qty,
        }));

  if (lines.length === 0) return <p className="text-graphite">Your cart is empty.</p>;

  const setQty = (productId: string, qty: number) =>
    status === 'authed' ? mut.setQty.mutate({ productId, qty }) : guest.setQty(productId, qty);
  const remove = (productId: string) =>
    status === 'authed' ? mut.remove.mutate(productId) : guest.remove(productId);

  const total = lines.reduce((n, l) => n + l.priceCents * l.qty, 0);
  const currency = lines[0]?.currency ?? 'USD';

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-hairline border-y border-hairline">
        {lines.map((l) => (
          <li key={l.productId} className="flex items-center justify-between gap-4 py-4">
            <span className="font-display text-ink">{l.title}</span>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={1}
                value={l.qty}
                onChange={(e) => setQty(l.productId, Number(e.target.value))}
                className="w-16 rounded-sm border border-hairline bg-surface px-2 py-1 font-mono text-sm"
                aria-label={`Quantity for ${l.title}`}
              />
              <Price cents={l.priceCents * l.qty} currency={l.currency} />
              <button
                onClick={() => remove(l.productId)}
                className="text-sm text-graphite hover:text-accent"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-hairline pt-4">
        <span className="font-mono text-sm uppercase tracking-widest text-graphite">Total</span>
        <Price cents={total} currency={currency} className="text-lg" />
      </div>
    </div>
  );
}
