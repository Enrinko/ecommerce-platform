import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createProduct,
  getAdminProduct,
  getAdminStats,
  listAdminProducts,
  listAllOrders,
  listUsers,
  updateOrderStatus,
} from './index';

afterEach(() => vi.unstubAllGlobals());

function capture(status: number, body: unknown) {
  const spy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

describe('admin api-client', () => {
  it('POSTs a product with the access token', async () => {
    const spy = capture(201, { id: 'p1' });
    await createProduct(
      { title: 'X', slug: 'x', description: 'd', priceCents: 100, categoryId: 'c1' } as never,
      { baseUrl: 'http://api', accessToken: 'tok' },
    );
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api/products');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok');
  });

  it('builds the admin orders query and PATCHes status', async () => {
    const spy = capture(200, { items: [], total: 0, page: 2, limit: 20 });
    await listAllOrders({ page: 2 }, { baseUrl: 'http://api' });
    expect(spy.mock.calls[0][0]).toBe('http://api/admin/orders?page=2');

    const spy2 = capture(200, { id: 'o1', status: 'SHIPPED' });
    await updateOrderStatus('o1', 'SHIPPED', { baseUrl: 'http://api' });
    const [url, init] = spy2.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api/admin/orders/o1/status');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'SHIPPED' });
  });

  it('reads the admin product list and a single product', async () => {
    const spy = capture(200, { items: [], total: 0, page: 3, limit: 50 });
    await listAdminProducts({ page: 3, limit: 50 }, { baseUrl: 'http://api', accessToken: 'tok' });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api/admin/products?page=3&limit=50');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok');

    const spy2 = capture(200, { id: 'p1', isActive: false });
    await getAdminProduct('p1', { baseUrl: 'http://api' });
    expect(spy2.mock.calls[0][0]).toBe('http://api/admin/products/p1');
  });

  it('reads the admin users page and stats', async () => {
    const spy = capture(200, { items: [], total: 0, page: 1, limit: 100 });
    await listUsers({ limit: 100 }, { baseUrl: 'http://api', accessToken: 'tok' });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api/admin/users?limit=100');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok');

    const spy2 = capture(200, { ordersTotal: 0 });
    await getAdminStats({ baseUrl: 'http://api' });
    expect(spy2.mock.calls[0][0]).toBe('http://api/admin/stats');
  });
});
