import { z } from 'zod';
import { currency, pageQuery } from './common';

export const product = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  priceCents: z.number().int(),
  currency,
  stock: z.number().int(),
  images: z.array(z.string()),
  isActive: z.boolean(),
  categoryId: z.string().uuid(),
  category: z.object({ id: z.string().uuid(), name: z.string(), slug: z.string() }).optional(),
  createdAt: z.coerce.date(),
});
export type Product = z.infer<typeof product>;

export const createProductInput = z.object({
  title: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().min(1),
  priceCents: z.number().int().min(0),
  currency: currency.default('USD'),
  stock: z.number().int().min(0).default(0),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  categoryId: z.string().uuid(),
});
export type CreateProductInput = z.infer<typeof createProductInput>;

export const updateProductInput = createProductInput.partial();
export type UpdateProductInput = z.infer<typeof updateProductInput>;

export const productListQuery = pageQuery
  .extend({
    category: z.string().trim().min(1).optional(), // category slug
    q: z.string().trim().min(1).optional(),
    minPriceCents: z.coerce.number().int().min(0).optional(),
    maxPriceCents: z.coerce.number().int().min(0).optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  })
  .refine(
    (q) =>
      q.minPriceCents === undefined ||
      q.maxPriceCents === undefined ||
      q.minPriceCents <= q.maxPriceCents,
    { message: 'minPriceCents must be <= maxPriceCents', path: ['minPriceCents'] },
  );
export type ProductListQuery = z.infer<typeof productListQuery>;
