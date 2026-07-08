import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Catalog (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /categories -> seeded categories', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body[0]).toHaveProperty('slug');
  });

  it('GET /products -> paginated envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/products?limit=5').expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({ page: 1, limit: 5, total: expect.any(Number), items: expect.any(Array) }),
    );
    expect(res.body.items.length).toBeLessThanOrEqual(5);
  });

  it('GET /products?category=audio -> only audio products', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/products?category=audio&limit=50')
      .expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const p of res.body.items) expect(p.category.slug).toBe('audio');
  });

  it('GET /products?sort=price_asc -> ascending by price', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/products?sort=price_asc&limit=50')
      .expect(200);
    const prices = res.body.items.map((p: { priceCents: number }) => p.priceCents);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('GET /products/:slug -> one product; unknown -> 404', async () => {
    await request(app.getHttpServer()).get('/api/v1/products/wireless-headphones').expect(200);
    await request(app.getHttpServer()).get('/api/v1/products/does-not-exist').expect(404);
  });
});
