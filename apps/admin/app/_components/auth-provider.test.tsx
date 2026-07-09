import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ refresh: vi.fn(), me: vi.fn(), login: vi.fn(), logout: vi.fn() }));
vi.mock('@repo/api-client', async (orig) => ({ ...(await orig<object>()), ...api }));

import { AuthProvider, useAuth } from './auth-provider';

function Probe() {
  const { status, user } = useAuth();
  return (
    <span>
      {status}:{user?.role ?? '-'}
    </span>
  );
}

afterEach(() => Object.values(api).forEach((m) => m.mockReset()));

describe('admin AuthProvider', () => {
  it('authes an ADMIN session on silent refresh', async () => {
    api.refresh.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
    api.me.mockResolvedValueOnce({ id: 'u1', email: 'a@x.io', role: 'ADMIN' });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('authed:ADMIN')).toBeInTheDocument());
  });

  it('treats a CUSTOMER session as guest', async () => {
    api.refresh.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
    api.me.mockResolvedValueOnce({ id: 'u2', email: 'c@x.io', role: 'CUSTOMER' });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('guest:-')).toBeInTheDocument());
  });
});
