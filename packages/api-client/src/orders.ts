import type { CreateOrderInput, PageQuery } from '@repo/types';
import { apiFetch, toQuery, type RequestOptions } from './http';

export type Order = { id: string; status: string; totalCents: number; currency: string; items: unknown[] };
export type OrderList = { items: Order[]; total: number; page: number; limit: number };

export function checkout(input: CreateOrderInput, opts?: RequestOptions): Promise<Order> {
  return apiFetch<Order>('/orders', { ...opts, init: { ...opts?.init, method: 'POST', body: JSON.stringify(input) } });
}
export function listMyOrders(query: Partial<PageQuery> = {}, opts?: RequestOptions): Promise<OrderList> {
  return apiFetch<OrderList>(`/orders${toQuery(query)}`, opts);
}
export function getOrder(id: string, opts?: RequestOptions): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}`, opts);
}
