'use client';

import Link from 'next/link';
import { useAuth } from './auth-provider';
import { CartBadge } from './cart-badge';

export function HeaderAccount() {
  const { status, user, logout } = useAuth();
  return (
    <div className="flex items-center gap-4 text-sm">
      {status === 'authed' && user ? (
        <>
          <Link href="/account/orders" className="text-graphite hover:text-accent">
            Orders
          </Link>
          <span className="hidden font-mono text-xs text-graphite sm:inline">{user.email}</span>
          <button onClick={() => logout()} className="text-graphite hover:text-accent">
            Log out
          </button>
        </>
      ) : (
        <Link href="/login" className="text-graphite hover:text-accent">
          Account
        </Link>
      )}
      <CartBadge />
    </div>
  );
}
