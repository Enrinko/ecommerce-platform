import { validateEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://shop:shop@localhost:5432/shop',
  MONGO_URL: 'mongodb://localhost:27017/shop',
  JWT_ACCESS_SECRET: 'a'.repeat(16),
  JWT_REFRESH_SECRET: 'b'.repeat(16),
};

describe('validateEnv', () => {
  it('parses a valid env and fills defaults', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.PAYMENT_PROVIDER).toBe('mock');
    expect(env.NODE_ENV).toBe('development');
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omit, ...rest } = base;
    expect(() => validateEnv(rest)).toThrow(/Invalid environment/);
  });
});
