import type { Paginated, Product, ProductListQuery } from '@repo/types';
import { apiFetch, toQuery, type RequestOptions } from './http';

export type ProductDetail = Product & { rating: { avg: number; count: number } };

export function listProducts(
  query: Partial<ProductListQuery> = {},
  opts?: RequestOptions,
): Promise<Paginated<Product>> {
  return apiFetch<Paginated<Product>>(`/products${toQuery(query)}`, opts);
}

export function getProduct(slug: string, opts?: RequestOptions): Promise<ProductDetail> {
  return apiFetch<ProductDetail>(`/products/${slug}`, opts);
}
