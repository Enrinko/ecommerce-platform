import type { Category } from '@repo/types';
import { apiFetch, type RequestOptions } from './http';

export function listCategories(opts?: RequestOptions): Promise<Category[]> {
  return apiFetch<Category[]>('/categories', opts);
}
