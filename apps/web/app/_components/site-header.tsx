import Link from 'next/link';
import { listCategories } from '@repo/api-client';
import { catalogHref } from '@/lib/catalog-params';
import { Ruler } from './ruler';
import { HeaderAccount } from './header-account';

export async function SiteHeader() {
  const categories = await listCategories().catch(() => []);
  return (
    <header className="bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight text-ink">
          Measured
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {categories.slice(0, 4).map((c) => (
            <Link
              key={c.id}
              href={catalogHref({ category: c.slug })}
              className="text-graphite hover:text-accent"
            >
              {c.name}
            </Link>
          ))}
          <Link href="/products" className="font-medium text-ink hover:text-accent">
            Catalog
          </Link>
          <HeaderAccount />
        </nav>
      </div>
      <Ruler />
    </header>
  );
}
