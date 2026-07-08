import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Admin catalog (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    // admin is seeded from ADMIN_EMAIL/ADMIN_PASSWORD
    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    adminToken = admin.body.accessToken;

    const cust = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `cust_${Date.now()}@example.com`, password: 'secret123' });
    customerToken = cust.body.accessToken;
  });
  afterAll(async () => {
    await app.close();
  });

  it('customer cannot create a product (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'X',
        slug: 'x-prod',
        description: 'x',
        priceCents: 100,
        categoryId: '00000000-0000-0000-0000-000000000000',
      })
      .expect(403);
  });

  it('anonymous cannot create a product (401)', async () => {
    await request(app.getHttpServer()).post('/api/v1/products').send({}).expect(401);
  });

  it('admin creates a category then a product; product shows in public listing', async () => {
    const cat = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Gadgets', slug: `gadgets-${Date.now()}` })
      .expect(201);

    const slug = `admin-widget-${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Admin Widget',
        slug,
        description: 'made by admin',
        priceCents: 4200,
        categoryId: cat.body.id,
      })
      .expect(201);

    const listed = await request(app.getHttpServer()).get(`/api/v1/products/${slug}`).expect(200);
    expect(listed.body.priceCents).toBe(4200);
  });
});
