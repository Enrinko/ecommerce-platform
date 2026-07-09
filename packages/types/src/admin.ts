import { z } from 'zod';

export const userListItem = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['CUSTOMER', 'ADMIN']),
  createdAt: z.coerce.date(),
  orderCount: z.number().int(),
});
export type UserListItem = z.infer<typeof userListItem>;

export const ordersByStatus = z.object({
  PENDING: z.number().int(),
  PAID: z.number().int(),
  SHIPPED: z.number().int(),
  DELIVERED: z.number().int(),
  CANCELLED: z.number().int(),
});
export type OrdersByStatus = z.infer<typeof ordersByStatus>;

export const adminStats = z.object({
  ordersTotal: z.number().int(),
  ordersByStatus,
  revenueCents: z.number().int(),
  productCount: z.number().int(),
  userCount: z.number().int(),
});
export type AdminStats = z.infer<typeof adminStats>;
