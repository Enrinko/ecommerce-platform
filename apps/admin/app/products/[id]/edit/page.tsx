'use client';

import { useParams, useRouter } from 'next/navigation';
import { AdminShell } from '../../../_components/admin-shell';
import { ProductForm } from '../../../_components/product-form';
import { useAdminProduct, useCategories, useProductMutations } from '@/lib/catalog';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const product = useAdminProduct(id);
  const cats = useCategories();
  const m = useProductMutations();

  if (product.isLoading) {
    return (
      <AdminShell>
        <p className="text-graphite">Loading…</p>
      </AdminShell>
    );
  }
  if (product.isError || !product.data) {
    return (
      <AdminShell>
        <p className="text-accent">Product not found.</p>
      </AdminShell>
    );
  }
  const p = product.data;
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">Edit {p.title}</h1>
      <ProductForm
        categories={cats.data ?? []}
        defaultValues={{
          title: p.title,
          slug: p.slug,
          description: p.description,
          priceCents: p.priceCents,
          currency: p.currency,
          stock: p.stock,
          images: p.images,
          isActive: p.isActive,
          categoryId: p.categoryId,
        }}
        submitting={m.update.isPending}
        error={m.update.isError ? 'Could not update the product.' : null}
        onSubmit={(v) =>
          m.update.mutate({ id: p.id, input: v }, { onSuccess: () => router.push('/products') })
        }
      />
    </AdminShell>
  );
}
