import { z } from 'zod';

export const category = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});
export type Category = z.infer<typeof category>;
