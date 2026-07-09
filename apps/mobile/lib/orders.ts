import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkout, type Order } from '@repo/api-client';
import type { CreateOrderInput } from '@repo/types';
import { authed } from './api';

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation<Order, unknown, CreateOrderInput>({
    mutationFn: (input) => authed((o) => checkout(input, o)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
  });
}
