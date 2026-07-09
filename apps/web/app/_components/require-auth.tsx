'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'guest') router.replace('/login');
  }, [status, router]);

  if (status !== 'authed') return null;
  return <>{children}</>;
}
