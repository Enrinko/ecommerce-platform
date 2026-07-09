'use client';

import { ApiError } from '@repo/api-client';
import { AdminShell } from '../_components/admin-shell';
import { CategoriesManager } from '../_components/categories-manager';
import { useCategories, useCategoryMutations } from '@/lib/catalog';

export default function CategoriesPage() {
  const cats = useCategories();
  const m = useCategoryMutations();
  const deleteError =
    m.remove.error instanceof ApiError && m.remove.error.status === 409
      ? 'You can’t delete a category that still has products.'
      : m.remove.isError
        ? 'Could not delete the category.'
        : null;
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">Categories</h1>
      <CategoriesManager
        categories={cats.data ?? []}
        creating={m.create.isPending}
        error={m.create.isError ? 'Could not create the category.' : deleteError}
        onCreate={(v) => m.create.mutate(v)}
        onUpdate={(id, input) => m.update.mutate({ id, input })}
        onDelete={(id) => m.remove.mutate(id)}
      />
    </AdminShell>
  );
}
