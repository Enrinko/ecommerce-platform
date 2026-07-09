'use client';

import Link from 'next/link';
import { RequireAdmin } from './require-admin';
import { useAuth } from './auth-provider';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/products', label: 'Products' },
  { href: '/categories', label: 'Categories' },
  { href: '/orders', label: 'Orders' },
  { href: '/users', label: 'Users' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <RequireAdmin>
      <div className="grid min-h-dvh grid-cols-[13rem_1fr]">
        <aside className="border-r border-hairline bg-surface">
          <div className="p-4 font-display text-lg font-semibold text-ink">Measured Admin</div>
          <nav className="flex flex-col p-2 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-sm px-3 py-2 text-graphite hover:bg-paper hover:text-accent"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex flex-col">
          <header className="flex items-center justify-end gap-4 border-b border-hairline px-6 py-3 text-sm">
            <span className="font-mono text-xs text-graphite">{user?.email}</span>
            <button onClick={() => logout()} className="text-graphite hover:text-accent">
              Log out
            </button>
          </header>
          <main className="p-6">{children}</main>
        </div>
      </div>
    </RequireAdmin>
  );
}
