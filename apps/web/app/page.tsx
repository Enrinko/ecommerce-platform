import Link from 'next/link';
import { listProducts } from '@repo/api-client';
import { Button } from '@repo/ui';
import { ProductGrid } from './_components/product-grid';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { items } = await listProducts({ limit: 8 }).catch(() => ({ items: [] }));
  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-graphite">Everyday tech</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          Precisely chosen gear for the way you work.
        </h1>
        <div className="mt-6">
          <Link href="/products">
            <Button>Browse the catalog</Button>
          </Link>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="mb-4 font-display text-lg font-medium text-ink">Featured</h2>
        <ProductGrid products={items} />
      </section>
    </main>
  );
}
