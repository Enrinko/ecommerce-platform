'use client';

import Link from 'next/link';
import { AdminShell } from '../_components/admin-shell';
import { ProductsTable } from '../_components/products-table';
import { useAdminProducts, useProductMutations } from '@/lib/catalog';

export default function ProductsPage() {
  const products = useAdminProducts();
  const m = useProductMutations();
  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Products</h1>
        <Link
          href="/products/new"
          className="rounded-sm bg-accent px-3 py-2 text-sm text-accent-ink"
        >
          New product
        </Link>
      </div>
      {products.isLoading ? (
        <p className="mt-6 text-graphite">Loading…</p>
      ) : products.isError ? (
        <p className="mt-6 text-accent">Failed to load products.</p>
      ) : (
        <ProductsTable
          products={products.data?.items ?? []}
          onSetActive={(id, isActive) => m.setActive.mutate({ id, isActive })}
          onDelete={(id) => m.remove.mutate(id)}
        />
      )}
      {m.remove.isError && (
        <p className="mt-2 text-sm text-accent">
          Couldn’t delete — the product is referenced by orders. Deactivate it instead.
        </p>
      )}
    </AdminShell>
  );
}
