import { useQuery } from '@tanstack/react-query';
import { listUsers } from '@repo/api-client';
import type { Paginated, UserListItem } from '@repo/types';
import { authed } from './auth-client';

export function useAdminUsers() {
  return useQuery<Paginated<UserListItem>>({
    queryKey: ['admin', 'users'],
    queryFn: () => authed((o) => listUsers({ limit: 100 }, o)),
  });
}
