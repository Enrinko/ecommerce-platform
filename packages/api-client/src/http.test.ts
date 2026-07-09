import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './http';

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('apiFetch', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { id: '1' }));
    await expect(apiFetch('/x', { baseUrl: 'http://api' })).resolves.toEqual({ id: '1' });
  });

  it('throws ApiError carrying status, message and field errors', async () => {
    vi.stubGlobal('fetch', mockFetch(400, { statusCode: 400, message: 'Validation failed', errors: { email: ['Invalid'] } }));
    await expect(apiFetch('/x', { baseUrl: 'http://api' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Validation failed',
      errors: { email: ['Invalid'] },
    });
  });

  it('sends a Bearer header when an access token is given', async () => {
    const spy = mockFetch(200, {});
    vi.stubGlobal('fetch', spy);
    await apiFetch('/x', { baseUrl: 'http://api', accessToken: 'tok' });
    const headers = new Headers((spy.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get('authorization')).toBe('Bearer tok');
  });
});
