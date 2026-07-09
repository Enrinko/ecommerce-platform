import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const useAuth = vi.fn();
vi.mock('./auth-provider', () => ({ useAuth: () => useAuth() }));

import { RequireAdmin } from './require-admin';

describe('RequireAdmin', () => {
  it('renders children when authed', () => {
    useAuth.mockReturnValue({ status: 'authed' });
    render(
      <RequireAdmin>
        <p>panel</p>
      </RequireAdmin>,
    );
    expect(screen.getByText('panel')).toBeInTheDocument();
  });

  it('redirects non-admins to /login', () => {
    useAuth.mockReturnValue({ status: 'guest' });
    render(
      <RequireAdmin>
        <p>panel</p>
      </RequireAdmin>,
    );
    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('panel')).not.toBeInTheDocument();
  });
});
