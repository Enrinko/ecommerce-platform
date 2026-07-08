import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Reviews (e2e)', () => {
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
      .send({ email: `rev_${Date.now()}@example.com`, password: 'secret123' });
    token = reg.body.accessToken;

    const products = await request(app.getHttpServer()).get('/api/v1/products?limit=1');
    productId = products.body.items[0].id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('requires auth to post a review', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/reviews`)
      .send({ rating: 5, title: 'Nice', body: 'Great' })
      .expect(401);
  });

  it('creates a review and lists it with the rating aggregate', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 4, title: 'Good', body: 'Works well' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}/reviews`)
      .expect(200);
    expect(res.body.rating.count).toBeGreaterThanOrEqual(1);
    expect(res.body.rating.avg).toBeGreaterThan(0);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    // spec §7: lists use the { items, total, page, limit } envelope
    expect(typeof res.body.total).toBe('number');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  it('rejects an invalid rating (validation)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 9, title: 'x', body: 'y' })
      .expect(400);
  });

  it('rejects a review for a non-existent product (404)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/products/00000000-0000-0000-0000-000000000000/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, title: 'ghost', body: 'no such product' })
      .expect(404);
  });
});

describe('Product rating aggregate (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let slug: string;
  let productId: string;

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
      .send({ name: 'Rated', slug: `rated-${Date.now()}` });
    slug = `rated-item-${Date.now()}`;
    const prod = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Rated Item',
        slug,
        description: 'for rating tests',
        priceCents: 1000,
        categoryId: cat.body.id,
      });
    productId = prod.body.id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('product detail page includes the rating aggregate (spec §8.3)', async () => {
    const before = await request(app.getHttpServer()).get(`/api/v1/products/${slug}`).expect(200);
    expect(before.body.rating).toEqual({ avg: 0, count: 0 });

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `rater_${Date.now()}@example.com`, password: 'secret123' });
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .send({ rating: 4, title: 'ok', body: 'decent' })
      .expect(201);

    const after = await request(app.getHttpServer()).get(`/api/v1/products/${slug}`).expect(200);
    expect(after.body.rating.count).toBe(1);
    expect(after.body.rating.avg).toBe(4);
  });

  it('keeps count consistent under concurrent reviews from different users', async () => {
    const raters = 5;
    const tokens = await Promise.all(
      Array.from({ length: raters }, (_, i) =>
        request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({ email: `conc_${i}_${Date.now()}@example.com`, password: 'secret123' })
          .then((r) => r.body.accessToken as string),
      ),
    );

    await Promise.all(
      tokens.map((t) =>
        request(app.getHttpServer())
          .post(`/api/v1/products/${productId}/reviews`)
          .set('Authorization', `Bearer ${t}`)
          .send({ rating: 5, title: 'great', body: 'love it' }),
      ),
    );

    const res = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}/reviews`)
      .expect(200);
    // 1 from the previous test + 5 concurrent = 6; a lost update would show fewer.
    expect(res.body.rating.count).toBe(raters + 1);
    expect(res.body.total).toBe(raters + 1);
  });
});
