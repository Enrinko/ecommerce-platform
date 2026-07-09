import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  getAdminProduct,
  listAdminProducts,
  listCategories,
  updateCategory,
  updateProduct,
} from '@repo/api-client';
import type {
  Category,
  CreateCategoryInput,
  CreateProductInput,
  Paginated,
  Product,
  UpdateCategoryInput,
  UpdateProductInput,
} from '@repo/types';
import { authed } from './auth-client';

const PRODUCTS = ['admin', 'products'] as const;
const CATEGORIES = ['admin', 'categories'] as const;

export function useAdminProducts() {
  return useQuery<Paginated<Product>>({
    queryKey: PRODUCTS,
    queryFn: () => authed((o) => listAdminProducts({ limit: 100 }, o)),
  });
}

export function useAdminProduct(id: string) {
  return useQuery<Product>({
    queryKey: ['admin', 'product', id],
    queryFn: () => authed((o) => getAdminProduct(id, o)),
    enabled: Boolean(id),
  });
}

export function useCategories() {
  return useQuery<Category[]>({ queryKey: CATEGORIES, queryFn: () => listCategories() });
}

export function useProductMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: PRODUCTS });
  return {
    create: useMutation({
      mutationFn: (v: CreateProductInput) => authed((o) => createProduct(v, o)),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; input: UpdateProductInput }) =>
        authed((o) => updateProduct(v.id, v.input, o)),
      onSuccess: invalidate,
    }),
    setActive: useMutation({
      mutationFn: (v: { id: string; isActive: boolean }) =>
        authed((o) => updateProduct(v.id, { isActive: v.isActive }, o)),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => authed((o) => deleteProduct(id, o)),
      onSuccess: invalidate,
    }),
  };
}

export function useCategoryMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: CATEGORIES });
  return {
    create: useMutation({
      mutationFn: (v: CreateCategoryInput) => authed((o) => createCategory(v, o)),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; input: UpdateCategoryInput }) =>
        authed((o) => updateCategory(v.id, v.input, o)),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => authed((o) => deleteCategory(id, o)),
      onSuccess: invalidate,
    }),
  };
}
