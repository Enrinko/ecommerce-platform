import Link from 'next/link';
import { catalogHref } from '@/lib/catalog-params';
import type { ProductListQuery } from '@repo/types';

export function Pagination({ current, total }: { current: ProductListQuery; total: number }) {
  const pages = Math.max(1, Math.ceil(total / current.limit));
  if (pages <= 1) return null;
  const link = (p: number) => catalogHref({ ...current, page: p });
  return (
    <nav className="flex items-center justify-between border-t border-hairline pt-4 font-mono text-sm">
      {current.page > 1 ? (
        <Link href={link(current.page - 1)} className="text-accent hover:underline">
          ← Prev
        </Link>
      ) : (
        <span className="text-hairline">← Prev</span>
      )}
      <span className="text-graphite">
        Page {current.page} / {pages}
      </span>
      {current.page < pages ? (
        <Link href={link(current.page + 1)} className="text-accent hover:underline">
          Next →
        </Link>
      ) : (
        <span className="text-hairline">Next →</span>
      )}
    </nav>
  );
}
