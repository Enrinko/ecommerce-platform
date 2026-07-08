import { z } from 'zod';
import { pageQuery } from './common';

export const product = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  priceCents: z.number().int(),
  currency: z.string(),
  stock: z.number().int(),
  images: z.array(z.string()),
  isActive: z.boolean(),
  categoryId: z.string().uuid(),
  category: z.object({ id: z.string().uuid(), name: z.string(), slug: z.string() }).optional(),
  createdAt: z.coerce.date(),
});
export type Product = z.infer<typeof product>;

export const productListQuery = pageQuery.extend({
  category: z.string().trim().min(1).optional(), // category slug
  q: z.string().trim().min(1).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
});
export type ProductListQuery = z.infer<typeof productListQuery>;
