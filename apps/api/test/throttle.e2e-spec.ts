import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

// Auth endpoints must be rate-limited (spec §5.2 / roadmap §7) so password
// guessing and argon2-driven CPU exhaustion are bounded.
describe('Auth rate limiting (e2e)', () => {
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

  it('returns 429 once the per-window auth limit is exceeded', async () => {
    const attempts = 16; // AUTH_THROTTLE_LIMIT (15) + 1
    const statuses: number[] = [];
    for (let i = 0; i < attempts; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `nobody_${Date.now()}@example.com`, password: 'wrong-password' });
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
    expect(statuses[statuses.length - 1]).toBe(429);
  });
});
