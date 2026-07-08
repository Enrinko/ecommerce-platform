import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health -> 200 { status: "ok" }', () =>
    request(app.getHttpServer()).get('/api/v1/health').expect(200).expect({ status: 'ok' }));

  it('unknown route -> 404 with standard error shape', () =>
    request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .expect(404)
      .expect((res) => {
        if (typeof res.body.statusCode !== 'number' || typeof res.body.message !== 'string') {
          throw new Error(`unexpected error shape: ${JSON.stringify(res.body)}`);
        }
      }));
});
