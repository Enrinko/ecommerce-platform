import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const useAuth = vi.fn();
vi.mock('./auth-provider', () => ({ useAuth: () => useAuth() }));

import { RequireAuth } from './require-auth';

describe('RequireAuth', () => {
  it('renders children when authed', () => {
    useAuth.mockReturnValue({ status: 'authed' });
    render(
      <RequireAuth>
        <p>secret</p>
      </RequireAuth>,
    );
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
  it('redirects guests to /login', () => {
    useAuth.mockReturnValue({ status: 'guest' });
    render(
      <RequireAuth>
        <p>secret</p>
      </RequireAuth>,
    );
    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});
