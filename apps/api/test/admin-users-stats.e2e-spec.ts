import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Admin users + stats (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let customerToken: string;

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
    const cust = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `ustats_${Date.now()}@example.com`, password: 'secret123' });
    customerToken = cust.body.accessToken;
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /admin/users rejects anon (401) and customer (403)', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('GET /admin/users returns a page without password hashes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({ total: expect.any(Number), page: 1, limit: 100 }),
    );
    expect(Array.isArray(res.body.items)).toBe(true);
    const admin = res.body.items.find(
      (u: { email: string }) => u.email === process.env.ADMIN_EMAIL,
    );
    expect(admin).toBeTruthy();
    expect(admin).toEqual(
      expect.objectContaining({ role: 'ADMIN', orderCount: expect.any(Number) }),
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('tokenHash');
  });

  it('GET /admin/stats returns coherent aggregates for an admin', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/stats').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const s = res.body;
    for (const k of ['ordersTotal', 'revenueCents', 'productCount', 'userCount']) {
      expect(typeof s[k]).toBe('number');
    }
    const buckets = s.ordersByStatus;
    expect(Object.keys(buckets).sort()).toEqual([
      'CANCELLED',
      'DELIVERED',
      'PAID',
      'PENDING',
      'SHIPPED',
    ]);
    const sum = Object.values(buckets).reduce((a: number, b) => a + (b as number), 0);
    expect(sum).toBe(s.ordersTotal);
    expect(s.revenueCents).toBeGreaterThanOrEqual(0);
  });
});
