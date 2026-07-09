import { useQuery } from '@tanstack/react-query';
import {
  getProduct,
  listCategories,
  listProducts,
  listReviews,
  type ProductDetail,
  type ReviewList,
} from '@repo/api-client';
import type { Category, Paginated, Product, ProductListQuery } from '@repo/types';
import { API_BASE } from './api';

const opts = { baseUrl: API_BASE };

export function useProducts(query: Partial<ProductListQuery>) {
  return useQuery<Paginated<Product>>({
    queryKey: ['products', query],
    queryFn: () => listProducts(query, opts),
  });
}

export function useProduct(slug: string) {
  return useQuery<ProductDetail>({
    queryKey: ['product', slug],
    queryFn: () => getProduct(slug, opts),
    enabled: Boolean(slug),
  });
}

export function useCategories() {
  return useQuery<Category[]>({ queryKey: ['categories'], queryFn: () => listCategories(opts) });
}

export function useReviews(productId: string) {
  return useQuery<ReviewList>({
    queryKey: ['reviews', productId],
    queryFn: () => listReviews(productId, {}, opts),
    enabled: Boolean(productId),
  });
}
