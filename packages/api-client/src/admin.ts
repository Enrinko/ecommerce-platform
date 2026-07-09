import type {
  CreateCategoryInput,
  CreateProductInput,
  OrderStatusValue,
  PageQuery,
  Paginated,
  Product,
  UpdateCategoryInput,
  UpdateProductInput,
} from '@repo/types';
import { apiFetch, toQuery, type RequestOptions } from './http';
import type { Order, OrderList } from './orders';

const json = (method: string, body: unknown, opts?: RequestOptions): RequestOptions => ({
  ...opts,
  init: { ...opts?.init, method, body: JSON.stringify(body) },
});

export function createProduct(input: CreateProductInput, opts?: RequestOptions): Promise<Product> {
  return apiFetch<Product>('/products', json('POST', input, opts));
}
export function updateProduct(
  id: string,
  input: UpdateProductInput,
  opts?: RequestOptions,
): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`, json('PATCH', input, opts));
}
export function deleteProduct(id: string, opts?: RequestOptions): Promise<unknown> {
  return apiFetch<unknown>(`/products/${id}`, { ...opts, init: { ...opts?.init, method: 'DELETE' } });
}
export function createCategory(input: CreateCategoryInput, opts?: RequestOptions) {
  return apiFetch('/categories', json('POST', input, opts));
}
export function updateCategory(id: string, input: UpdateCategoryInput, opts?: RequestOptions) {
  return apiFetch(`/categories/${id}`, json('PATCH', input, opts));
}
export function deleteCategory(id: string, opts?: RequestOptions) {
  return apiFetch(`/categories/${id}`, { ...opts, init: { ...opts?.init, method: 'DELETE' } });
}
export function listAllOrders(
  query: Partial<PageQuery> = {},
  opts?: RequestOptions,
): Promise<OrderList> {
  return apiFetch<OrderList>(`/admin/orders${toQuery(query)}`, opts);
}
export function updateOrderStatus(
  id: string,
  status: OrderStatusValue,
  opts?: RequestOptions,
): Promise<Order> {
  return apiFetch<Order>(`/admin/orders/${id}/status`, json('PATCH', { status }, opts));
}

// Admin catalog reads: return products of ANY status (incl. inactive), unlike
// the public listProducts/getProduct which filter isActive:true.
export function listAdminProducts(
  query: Partial<PageQuery> = {},
  opts?: RequestOptions,
): Promise<Paginated<Product>> {
  return apiFetch<Paginated<Product>>(`/admin/products${toQuery(query)}`, opts);
}
export function getAdminProduct(id: string, opts?: RequestOptions): Promise<Product> {
  return apiFetch<Product>(`/admin/products/${id}`, opts);
}
