import { z } from 'zod';

export const addCartItemInput = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().min(1),
});
export type AddCartItemInput = z.infer<typeof addCartItemInput>;

export const updateCartItemInput = z.object({ qty: z.number().int().min(1) });
export type UpdateCartItemInput = z.infer<typeof updateCartItemInput>;
