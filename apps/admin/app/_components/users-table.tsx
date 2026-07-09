'use client';

import type { UserListItem } from '@repo/types';

const cell = 'px-3 py-2 text-left align-middle';

export function UsersTable({ users }: { users: UserListItem[] }) {
  if (users.length === 0) {
    return <p className="mt-6 text-sm text-graphite">No users yet.</p>;
  }
  return (
    <table className="mt-6 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-hairline text-xs uppercase tracking-wide text-graphite">
          <th className={cell}>Email</th>
          <th className={cell}>Role</th>
          <th className={cell}>Orders</th>
          <th className={cell}>Joined</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-b border-hairline">
            <td className={cell}>{u.email}</td>
            <td className={cell}>
              <span
                className={
                  u.role === 'ADMIN'
                    ? 'font-mono text-xs text-accent'
                    : 'font-mono text-xs text-graphite'
                }
              >
                {u.role}
              </span>
            </td>
            <td className={cell}>{u.orderCount}</td>
            <td className={cell}>{new Date(u.createdAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
