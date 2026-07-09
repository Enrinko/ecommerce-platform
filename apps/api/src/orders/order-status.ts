import type { OrderStatus } from '@prisma/client';
import { orderTransitions } from '@repo/types';

// Single source of truth lives in @repo/types (shared with the admin UI, which
// offers only valid transitions). The server still validates every transition.
export const ALLOWED_TRANSITIONS = orderTransitions as Record<OrderStatus, OrderStatus[]>;

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
