import { z } from 'zod';

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof pageQuery>;

// Single source of truth for supported currencies. The platform is single-
// currency per order (mixed-currency carts are rejected at checkout).
export const currency = z.enum(['USD', 'EUR', 'GBP']);
export type Currency = z.infer<typeof currency>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export const errorResponse = z.object({
  statusCode: z.number(),
  message: z.string(),
  errors: z.record(z.array(z.string())).optional(),
});
export type ErrorResponse = z.infer<typeof errorResponse>;
