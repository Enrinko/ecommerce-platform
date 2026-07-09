'use client';

import { AdminShell } from '../_components/admin-shell';
import { UsersTable } from '../_components/users-table';
import { useAdminUsers } from '@/lib/users';

export default function UsersPage() {
  const users = useAdminUsers();
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">Users</h1>
      {users.isLoading ? (
        <p className="mt-6 text-graphite">Loading…</p>
      ) : users.isError ? (
        <p className="mt-6 text-accent">Failed to load users.</p>
      ) : (
        <UsersTable users={users.data?.items ?? []} />
      )}
    </AdminShell>
  );
}
