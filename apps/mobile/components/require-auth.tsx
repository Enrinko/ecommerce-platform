import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/auth-provider';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === 'guest') router.replace('/(auth)/login');
  }, [status, router]);
  if (status !== 'authed') return null;
  return <>{children}</>;
}
