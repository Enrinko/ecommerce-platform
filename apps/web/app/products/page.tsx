import type { Metadata } from 'next';
import { listCategories, listProducts } from '@repo/api-client';
import { parseCatalogParams } from '@/lib/catalog-params';
import { ProductGrid } from '@/app/_components/product-grid';
import { CatalogControls } from '@/app/_components/catalog-controls';
import { Pagination } from '@/app/_components/pagination';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Catalog' };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseCatalogParams(await searchParams);
  const [{ items, total }, categories] = await Promise.all([listProducts(query), listCategories()]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Catalog</h1>
      <p className="mt-1 font-mono text-sm text-graphite">{total} products</p>
      <div className="mt-6 space-y-6">
        <CatalogControls categories={categories} current={query} />
        <ProductGrid products={items} />
        <Pagination current={query} total={total} />
      </div>
    </main>
  );
}
