import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Cart (e2e)', () => {
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
      .send({ email: `cart_${Date.now()}@example.com`, password: 'secret123' });
    token = reg.body.accessToken;

    const products = await request(app.getHttpServer()).get('/api/v1/products?limit=1');
    productId = products.body.items[0].id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('requires auth', async () => {
    await request(app.getHttpServer()).get('/api/v1/cart').expect(401);
  });

  it('starts empty, adds an item, updates qty, removes it', async () => {
    const empty = await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(empty.body.items).toHaveLength(0);

    const added = await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, qty: 2 })
      .expect(201);
    expect(added.body.items).toHaveLength(1);
    expect(added.body.items[0].qty).toBe(2);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/cart/items/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ qty: 5 })
      .expect(200);
    expect(updated.body.items[0].qty).toBe(5);

    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/cart/items/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(removed.body.items).toHaveLength(0);
  });
});
