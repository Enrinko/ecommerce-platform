import { afterEach, describe, expect, it, vi } from 'vitest';
import { listProducts, login } from './index';

afterEach(() => vi.unstubAllGlobals());

function capture(status: number, body: unknown) {
  const spy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

describe('domain client', () => {
  it('builds a products query string, skipping undefined params', async () => {
    const spy = capture(200, { items: [], total: 0, page: 1, limit: 20 });
    await listProducts({ category: 'audio', page: 2, q: undefined }, { baseUrl: 'http://api' });
    const url = spy.mock.calls[0][0] as string;
    expect(url).toBe('http://api/products?category=audio&page=2');
  });

  it('POSTs credentials on login', async () => {
    const spy = capture(201, { accessToken: 'a', refreshToken: 'r' });
    await login({ email: 'e@x.io', password: 'pw' }, { baseUrl: 'http://api' });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'e@x.io', password: 'pw' });
  });
});
