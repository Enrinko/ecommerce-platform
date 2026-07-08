import { z } from 'zod';

export const category = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});
export type Category = z.infer<typeof category>;

export const createCategoryInput = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
});
export type CreateCategoryInput = z.infer<typeof createCategoryInput>;

export const updateCategoryInput = createCategoryInput.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategoryInput>;
