import { z } from 'zod';

export const orderStatus = z.enum(['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
export type OrderStatusValue = z.infer<typeof orderStatus>;

export const createOrderInput = z.object({
  shippingName: z.string().min(1),
  shippingAddr: z.string().min(1),
});
export type CreateOrderInput = z.infer<typeof createOrderInput>;

export const updateOrderStatusInput = z.object({ status: orderStatus });
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInput>;

// Single source of truth for the order lifecycle (server enforces; UI hints).
export const orderTransitions: Record<OrderStatusValue, OrderStatusValue[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function nextStatuses(status: OrderStatusValue): OrderStatusValue[] {
  return orderTransitions[status];
}
