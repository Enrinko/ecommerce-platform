import Link from 'next/link';
import { listCategories } from '@repo/api-client';
import { catalogHref } from '@/lib/catalog-params';
import { Ruler } from './ruler';
import { HeaderAccount } from './header-account';

export async function SiteHeader() {
  const categories = await listCategories().catch(() => []);
  return (
    <header className="bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <Link
          href="/"
          className="shrink-0 font-display text-lg font-semibold tracking-tight text-ink"
        >
          Measured
        </Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-4">
          {/* Category shortcuts are a desktop convenience; on mobile the catalog's
              own filters cover them, so hide them to avoid header overflow. */}
          <div className="hidden items-center gap-4 md:flex">
            {categories.slice(0, 4).map((c) => (
              <Link
                key={c.id}
                href={catalogHref({ category: c.slug })}
                className="text-graphite hover:text-accent"
              >
                {c.name}
              </Link>
            ))}
          </div>
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
