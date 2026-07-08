import { z } from 'zod';

// Upper bound guards against integer overflow of priceCents * qty and absurd carts.
const qty = z.number().int().min(1).max(10_000);

export const addCartItemInput = z.object({
  productId: z.string().uuid(),
  qty,
});
export type AddCartItemInput = z.infer<typeof addCartItemInput>;

export const updateCartItemInput = z.object({ qty });
export type UpdateCartItemInput = z.infer<typeof updateCartItemInput>;
