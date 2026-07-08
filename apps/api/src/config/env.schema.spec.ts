import { validateEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://shop:shop@localhost:5432/shop',
  MONGO_URL: 'mongodb://localhost:27017/shop',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
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

  it('rejects JWT secrets shorter than 32 chars', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/Invalid environment/);
  });

  it('does not default admin credentials in development', () => {
    const env = validateEnv(base);
    expect(env.ADMIN_EMAIL).toBeUndefined();
    expect(env.ADMIN_PASSWORD).toBeUndefined();
  });

  it('requires admin credentials in production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/Invalid environment/);
  });

  it('accepts production when admin credentials are provided', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'production',
      ADMIN_EMAIL: 'owner@example.com',
      ADMIN_PASSWORD: 'a-strong-admin-password',
    });
    expect(env.NODE_ENV).toBe('production');
    expect(env.ADMIN_EMAIL).toBe('owner@example.com');
  });
});
