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
  });

  it('rejects an invalid rating (validation)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 9, title: 'x', body: 'y' })
      .expect(400);
  });
});
