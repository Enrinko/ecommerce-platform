import { useQuery } from '@tanstack/react-query';
import { getAdminStats } from '@repo/api-client';
import type { AdminStats } from '@repo/types';
import { authed } from './auth-client';

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => authed((o) => getAdminStats(o)),
  });
}
