'use client';

import { useRouter } from 'next/navigation';
import type { Category, ProductListQuery } from '@repo/types';

export function CatalogControls({
  categories,
  current,
}: {
  categories: Category[];
  current: ProductListQuery;
}) {
  const router = useRouter();

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      category: current.category,
      q: current.q,
      sort: current.sort,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    router.push(params.toString() ? `/products?${params}` : '/products');
  }

  const field = 'flex flex-col gap-1 text-xs uppercase tracking-widest text-graphite';
  const control = 'border border-hairline bg-surface px-2 py-1 text-sm text-ink rounded-sm';

  return (
    <div className="flex flex-wrap items-end gap-4 border-b border-hairline pb-4">
      <label className={field}>
        Search
        <input
          type="search"
          defaultValue={current.q ?? ''}
          onBlur={(e) => update({ q: e.target.value })}
          className={`w-48 font-body ${control}`}
        />
      </label>
      <label className={field}>
        Category
        <select
          defaultValue={current.category ?? ''}
          onChange={(e) => update({ category: e.target.value })}
          className={control}
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        Sort
        <select
          defaultValue={current.sort}
          onChange={(e) => update({ sort: e.target.value })}
          className={control}
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
        </select>
      </label>
    </div>
  );
}
