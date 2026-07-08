import { z } from 'zod';

export const createReviewInput = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
});
export type CreateReviewInput = z.infer<typeof createReviewInput>;

export const productRating = z.object({ avg: z.number(), count: z.number().int() });
export type ProductRating = z.infer<typeof productRating>;
