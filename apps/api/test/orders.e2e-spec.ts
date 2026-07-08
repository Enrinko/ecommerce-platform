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
    expect(mine.body.length).toBeGreaterThanOrEqual(1);
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
