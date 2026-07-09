import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getOrder,
  listAllOrders,
  updateOrderStatus,
  type Order,
  type OrderList,
} from '@repo/api-client';
import type { OrderStatusValue } from '@repo/types';
import { authed } from './auth-client';

const ORDERS = ['admin', 'orders'] as const;

export function useAdminOrders() {
  return useQuery<OrderList>({
    queryKey: ORDERS,
    queryFn: () => authed((o) => listAllOrders({ limit: 100 }, o)),
  });
}

export function useAdminOrder(id: string) {
  return useQuery<Order>({
    queryKey: ['admin', 'order', id],
    queryFn: () => authed((o) => getOrder(id, o)),
    enabled: Boolean(id),
  });
}

export function useOrderStatusMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: OrderStatusValue) => authed((o) => updateOrderStatus(id, status, o)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS });
      qc.invalidateQueries({ queryKey: ['admin', 'order', id] });
    },
  });
}
