import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(3000),
    DATABASE_URL: z.string().url(),
    MONGO_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    ACCESS_TTL: z.string().default('15m'),
    REFRESH_TTL: z.string().default('7d'),
    CORS_ORIGINS: z.string().default(''),
    PAYMENT_PROVIDER: z.enum(['mock', 'stripe']).default('mock'),
    // Consumed only by the seed script (M2), never at API boot. No defaults:
    // a hardcoded admin password would be a fail-open working credential.
    // Optional in dev/test for convenience, but required in production.
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.ADMIN_EMAIL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ADMIN_EMAIL'],
          message: 'ADMIN_EMAIL is required in production (no default is allowed)',
        });
      }
      if (!env.ADMIN_PASSWORD) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ADMIN_PASSWORD'],
          message: 'ADMIN_PASSWORD is required in production (no default is allowed)',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    );
  }
  return parsed.data;
}
