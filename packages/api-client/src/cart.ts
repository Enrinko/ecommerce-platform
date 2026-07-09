import type { AddCartItemInput } from '@repo/types';
import { apiFetch, type RequestOptions } from './http';

// Cart response shape is owned by the API; typed loosely here until a Cart
// contract is added to @repo/types (tracked for M3).
export type Cart = { id: string; items: Array<{ productId: string; qty: number; product: unknown }> };

export function getCart(opts?: RequestOptions): Promise<Cart> {
  return apiFetch<Cart>('/cart', opts);
}
export function addCartItem(input: AddCartItemInput, opts?: RequestOptions): Promise<Cart> {
  return apiFetch<Cart>('/cart/items', { ...opts, init: { ...opts?.init, method: 'POST', body: JSON.stringify(input) } });
}
export function updateCartItem(productId: string, qty: number, opts?: RequestOptions): Promise<Cart> {
  return apiFetch<Cart>(`/cart/items/${productId}`, { ...opts, init: { ...opts?.init, method: 'PATCH', body: JSON.stringify({ qty }) } });
}
export function removeCartItem(productId: string, opts?: RequestOptions): Promise<Cart> {
  return apiFetch<Cart>(`/cart/items/${productId}`, { ...opts, init: { ...opts?.init, method: 'DELETE' } });
}
