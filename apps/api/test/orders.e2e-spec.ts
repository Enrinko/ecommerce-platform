import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let product: { id: string; priceCents: number };

  async function addToCart(productId: string, qty: number) {
    return request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, qty });
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `order_${Date.now()}@example.com`, password: 'secret123' });
    token = reg.body.accessToken;

    // Use a known high-stock seeded product by slug (deterministic; re-seed resets its stock).
    const seeded = await request(app.getHttpServer()).get('/api/v1/products/usb-c-cable');
    product = seeded.body;
  });
  afterAll(async () => {
    await app.close();
  });

  it('rejects checkout with an empty cart (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingName: 'A', shippingAddr: 'B' })
      .expect(400);
  });

  it('checks out: order PAID, total correct, cart cleared', async () => {
    await addToCart(product.id, 2);
    const order = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingName: 'Jane', shippingAddr: '1 Road' })
      .expect(201);

    expect(order.body.status).toBe('PAID');
    expect(order.body.totalCents).toBe(product.priceCents * 2);
    expect(order.body.items[0].priceCentsSnapshot).toBe(product.priceCents);

    const cart = await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(cart.body.items).toHaveLength(0);

    const mine = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    // spec §7: lists use the { items, total, page, limit } envelope
    expect(Array.isArray(mine.body.items)).toBe(true);
    expect(mine.body.items.length).toBeGreaterThanOrEqual(1);
    expect(typeof mine.body.total).toBe('number');
    expect(mine.body.page).toBe(1);
    expect(mine.body.limit).toBe(20);
  });

  it('rejects checkout exceeding stock (409)', async () => {
    await addToCart(product.id, 1000); // > seeded stock (200), safely within Int for total
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingName: 'Jane', shippingAddr: '1 Road' })
      .expect(409);
  });
});

describe('Checkout concurrency (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let productId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `concurrent_${Date.now()}@example.com`, password: 'secret123' });
    token = reg.body.accessToken;

    const seeded = await request(app.getHttpServer()).get('/api/v1/products/usb-c-cable');
    productId = seeded.body.id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('two simultaneous checkouts from one cart create exactly one order', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, qty: 1 });

    const fire = () =>
      request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ shippingName: 'Race', shippingAddr: 'Condition St' });

    const results = await Promise.all([fire(), fire()]);
    const created = results.filter((r) => r.status === 201).length;
    const rejected = results.filter((r) => r.status === 409 || r.status === 400).length;

    expect(created).toBe(1);
    expect(rejected).toBe(1);
  });
});

describe('Admin order status (e2e)', () => {
  let app: INestApplication;
  let customerToken: string;
  let adminToken: string;
  let orderId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `ostatus_${Date.now()}@example.com`, password: 'secret123' });
    customerToken = reg.body.accessToken;

    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    adminToken = admin.body.accessToken;

    const seeded = await request(app.getHttpServer()).get('/api/v1/products/laptop-sleeve');
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: seeded.body.id, qty: 1 });
    const order = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shippingName: 'S', shippingAddr: 'A' });
    orderId = order.body.id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('customer cannot change status (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'SHIPPED' })
      .expect(403);
  });

  it('exposes the customer email on admin order rows', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/orders?limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    const row = res.body.items.find((o: { id: string }) => o.id === orderId);
    expect(row.user).toEqual(expect.objectContaining({ email: expect.any(String) }));
  });

  it('admin advances PAID -> SHIPPED -> DELIVERED', async () => {
    const shipped = await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SHIPPED' })
      .expect(200);
    expect(shipped.body.status).toBe('SHIPPED');

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DELIVERED' })
      .expect(200);
  });

  it('rejects an illegal transition (409)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PENDING' })
      .expect(409);
  });
});

describe('Order currency (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let usdId: string;
  let eurId: string;

  async function freshCustomer() {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `cur_${Math.random().toString(36).slice(2)}@example.com`, password: 'secret123' });
    return reg.body.accessToken as string;
  }
  async function makeProduct(currency: string) {
    const slug = `cur-${currency.toLowerCase()}-${Math.random().toString(36).slice(2)}`;
    const cat = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'C', slug: `c-${slug}` });
    const prod = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Priced ${currency}`,
        slug,
        description: 'currency test',
        priceCents: 1000,
        currency,
        stock: 50,
        categoryId: cat.body.id,
      });
    return prod.body.id as string;
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    adminToken = admin.body.accessToken;
    usdId = await makeProduct('USD');
    eurId = await makeProduct('EUR');
  });
  afterAll(async () => {
    await app.close();
  });

  it('stamps the order with the products currency, not a hardcoded default', async () => {
    const token = await freshCustomer();
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: eurId, qty: 1 });
    const order = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingName: 'E', shippingAddr: 'U' })
      .expect(201);
    expect(order.body.currency).toBe('EUR');
  });

  it('refuses to check out a cart mixing currencies (409)', async () => {
    const token = await freshCustomer();
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: usdId, qty: 1 });
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: eurId, qty: 1 });
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingName: 'M', shippingAddr: 'X' })
      .expect(409);
  });
});

describe('Order status: stock return + concurrency (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let slug: string;
  let productId: string;

  async function stock() {
    const res = await request(app.getHttpServer()).get(`/api/v1/products/${slug}`);
    return res.body.stock as number;
  }
  async function orderFor(email: string, qty: number) {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'secret123' });
    const token = reg.body.accessToken;
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, qty });
    const order = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingName: 'S', shippingAddr: 'A' });
    return order.body.id as string;
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    adminToken = admin.body.accessToken;

    const cat = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Statusable', slug: `statusable-${Date.now()}` });
    slug = `statusable-item-${Date.now()}`;
    const prod = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Statusable Item',
        slug,
        description: 'status tests',
        priceCents: 500,
        stock: 20,
        categoryId: cat.body.id,
      });
    productId = prod.body.id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('cancelling an order returns its stock', async () => {
    const before = await stock();
    const orderId = await orderFor(`cancel_${Date.now()}@example.com`, 3);
    expect(await stock()).toBe(before - 3);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CANCELLED' })
      .expect(200);

    expect(await stock()).toBe(before);
  });

  it('two concurrent status transitions from PAID: exactly one wins', async () => {
    const orderId = await orderFor(`concstatus_${Date.now()}@example.com`, 1);

    const patch = (status: string) =>
      request(app.getHttpServer())
        .patch(`/api/v1/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status });

    const results = await Promise.all([patch('SHIPPED'), patch('CANCELLED')]);
    const ok = results.filter((r) => r.status === 200).length;
    const conflict = results.filter((r) => r.status === 409).length;
    expect(ok).toBe(1);
    expect(conflict).toBe(1);
  });
});
