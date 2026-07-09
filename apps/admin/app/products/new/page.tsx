'use client';

import { useRouter } from 'next/navigation';
import { AdminShell } from '../../_components/admin-shell';
import { ProductForm } from '../../_components/product-form';
import { useCategories, useProductMutations } from '@/lib/catalog';

export default function NewProductPage() {
  const router = useRouter();
  const cats = useCategories();
  const m = useProductMutations();
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">New product</h1>
      <ProductForm
        categories={cats.data ?? []}
        submitting={m.create.isPending}
        error={m.create.isError ? 'Could not create the product.' : null}
        onSubmit={(v) => m.create.mutate(v, { onSuccess: () => router.push('/products') })}
      />
    </AdminShell>
  );
}
