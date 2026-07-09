import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Admin product reads (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let customerToken: string;
  let inactiveId: string;

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
      .send({ email: `pcust_${Date.now()}@example.com`, password: 'secret123' });
    customerToken = cust.body.accessToken;

    const cat = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'AdminRead', slug: `adminread-${Date.now()}` });
    const created = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Deactivated Item',
        slug: `deact-${Date.now()}`,
        description: 'hidden from storefront',
        priceCents: 1234,
        isActive: false,
        categoryId: cat.body.id,
      })
      .expect(201);
    inactiveId = created.body.id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('rejects anonymous (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/products').expect(401);
  });

  it('rejects a customer (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('lists all products for an admin, including inactive ones', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/products?limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({ total: expect.any(Number), page: 1, limit: 100 }),
    );
    const ids = (res.body.items as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain(inactiveId);
  });

  it('reads a single inactive product by id for an admin', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/products/${inactiveId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.isActive).toBe(false);
  });

  it('returns 404 (not 500) for a missing product id', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/products/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
