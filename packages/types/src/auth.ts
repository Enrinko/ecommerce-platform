import { z } from 'zod';

export const registerInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72), // argon2/bcrypt-safe upper bound
});
export type RegisterInput = z.infer<typeof registerInput>;

export const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInput>;

export const authTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof authTokens>;

export const meResponse = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['CUSTOMER', 'ADMIN']),
});
export type MeResponse = z.infer<typeof meResponse>;
