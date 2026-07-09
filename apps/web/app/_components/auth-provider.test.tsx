import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  refresh: vi.fn(),
  me: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('@repo/api-client', async (orig) => ({ ...(await orig<object>()), ...api }));
vi.mock('@/lib/cart', () => ({ mergeGuestCartIntoServer: vi.fn().mockResolvedValue(undefined) }));

import { AuthProvider, useAuth } from './auth-provider';

function Probe() {
  const { status, user } = useAuth();
  return (
    <span>
      {status}:{user?.email ?? '-'}
    </span>
  );
}

afterEach(() => Object.values(api).forEach((m) => m.mockReset()));

describe('AuthProvider', () => {
  it('restores a session via silent refresh on mount', async () => {
    api.refresh.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
    api.me.mockResolvedValueOnce({ id: 'u1', email: 'me@x.io', role: 'CUSTOMER' });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('authed:me@x.io')).toBeInTheDocument());
  });

  it('falls back to guest when there is no session', async () => {
    api.refresh.mockRejectedValueOnce(new Error('no session'));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('guest:-')).toBeInTheDocument());
  });
});
