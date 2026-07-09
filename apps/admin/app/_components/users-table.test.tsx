import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UserListItem } from '@repo/types';
import { UsersTable } from './users-table';

const users: UserListItem[] = [
  {
    id: 'u1',
    email: 'admin@example.com',
    role: 'ADMIN',
    createdAt: new Date('2026-01-01'),
    orderCount: 0,
  },
  {
    id: 'u2',
    email: 'buyer@example.com',
    role: 'CUSTOMER',
    createdAt: new Date('2026-02-02'),
    orderCount: 5,
  },
];

describe('UsersTable', () => {
  it('renders a row per user with role and order count', () => {
    render(<UsersTable users={users} />);
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    expect(screen.getByText('buyer@example.com')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows an empty state', () => {
    render(<UsersTable users={[]} />);
    expect(screen.getByText(/no users/i)).toBeInTheDocument();
  });
});
