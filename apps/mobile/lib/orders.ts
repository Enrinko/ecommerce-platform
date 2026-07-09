import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkout, getOrder, listMyOrders, type Order, type OrderList } from '@repo/api-client';
import type { CreateOrderInput } from '@repo/types';
import { authed } from './api';

const LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export function orderStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation<Order, unknown, CreateOrderInput>({
    mutationFn: (input) => authed((o) => checkout(input, o)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useMyOrders(page = 1) {
  return useQuery<OrderList>({
    queryKey: ['orders', page],
    queryFn: () => authed((o) => listMyOrders({ page }, o)),
  });
}

export function useOrder(id: string) {
  return useQuery<Order>({
    queryKey: ['order', id],
    queryFn: () => authed((o) => getOrder(id, o)),
    enabled: Boolean(id),
  });
}
