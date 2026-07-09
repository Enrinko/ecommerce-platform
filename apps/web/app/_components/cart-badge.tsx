'use client';

import Link from 'next/link';
import { useAuth } from './auth-provider';
import { useGuestCart } from '@/lib/guest-cart';
import { useServerCart } from '@/lib/cart';

export function CartBadge() {
  const { status } = useAuth();
  const guestCount = useGuestCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const server = useServerCart(status === 'authed');
  const count =
    status === 'authed' ? (server.data?.items.reduce((n, i) => n + i.qty, 0) ?? 0) : guestCount;
  return (
    <Link href="/cart" className="font-mono text-sm text-ink hover:text-accent">
      Cart [{count}]
    </Link>
  );
}
