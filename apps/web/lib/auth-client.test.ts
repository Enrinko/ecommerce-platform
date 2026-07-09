import { afterEach, describe, expect, it, vi } from 'vitest';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('@repo/api-client', async (orig) => {
  const actual = await orig<typeof import('@repo/api-client')>();
  return { ...actual, refresh };
});

import { ApiError } from '@repo/api-client';
import { authed, getAccessToken, setAccessToken } from './auth-client';

afterEach(() => {
  refresh.mockReset();
  setAccessToken(null);
});

describe('authed', () => {
  it('passes the current token and returns the result', async () => {
    setAccessToken('tok');
    const call = vi.fn(async (o: { accessToken?: string }) => o.accessToken);
    await expect(authed(call)).resolves.toBe('tok');
  });

  it('refreshes once and retries on 401', async () => {
    setAccessToken('stale');
    refresh.mockResolvedValueOnce({ accessToken: 'fresh', refreshToken: 'r' });
    const call = vi
      .fn<(o: { accessToken?: string }) => Promise<string>>()
      .mockRejectedValueOnce(new ApiError(401, 'expired'))
      .mockResolvedValueOnce('ok');
    await expect(authed(call)).resolves.toBe('ok');
    expect(refresh).toHaveBeenCalledOnce();
    expect(getAccessToken()).toBe('fresh');
    expect(call).toHaveBeenLastCalledWith({ accessToken: 'fresh' });
  });

  it('clears the token and rethrows when refresh fails', async () => {
    setAccessToken('stale');
    refresh.mockRejectedValueOnce(new ApiError(401, 'no session'));
    const call = vi.fn<(o: { accessToken?: string }) => Promise<string>>().mockRejectedValue(
      new ApiError(401, 'expired'),
    );
    await expect(authed(call)).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
  });
});
