import type { CreateReviewInput, PageQuery, ProductRating } from '@repo/types';
import { apiFetch, toQuery, type RequestOptions } from './http';

export type ReviewList = {
  items: Array<{ productId: string; userId: string; rating: number; title: string; body: string }>;
  total: number;
  page: number;
  limit: number;
  rating: ProductRating;
};

export function listReviews(productId: string, query: Partial<PageQuery> = {}, opts?: RequestOptions): Promise<ReviewList> {
  return apiFetch<ReviewList>(`/products/${productId}/reviews${toQuery(query)}`, opts);
}
export function createReview(productId: string, input: CreateReviewInput, opts?: RequestOptions): Promise<ReviewList> {
  return apiFetch<ReviewList>(`/products/${productId}/reviews`, { ...opts, init: { ...opts?.init, method: 'POST', body: JSON.stringify(input) } });
}
