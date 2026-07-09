import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkout, getOrder, listMyOrders } from '@repo/api-client';
import type { CreateOrderInput } from '@repo/types';
import { authed } from './auth-client';

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
  return useMutation({
    mutationFn: (input: CreateOrderInput) => authed((o) => checkout(input, o)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useMyOrders(page = 1) {
  return useQuery({
    queryKey: ['orders', page],
    queryFn: () => authed((o) => listMyOrders({ page }, o)),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => authed((o) => getOrder(id, o)),
  });
}
