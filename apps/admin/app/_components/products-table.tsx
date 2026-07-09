'use client';

import Link from 'next/link';
import type { Product } from '@repo/types';
import { Price } from '@repo/ui';

const cell = 'px-3 py-2 text-left align-middle';
const action = 'text-graphite hover:text-accent';

export function ProductsTable({
  products,
  onSetActive,
  onDelete,
}: {
  products: Product[];
  onSetActive: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
}) {
  if (products.length === 0) {
    return <p className="mt-6 text-sm text-graphite">No products yet.</p>;
  }
  return (
    <table className="mt-6 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-hairline text-xs uppercase tracking-wide text-graphite">
          <th className={cell}>Title</th>
          <th className={cell}>Slug</th>
          <th className={cell}>Price</th>
          <th className={cell}>Stock</th>
          <th className={cell}>Category</th>
          <th className={cell}>Status</th>
          <th className={cell}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr key={p.id} className="border-b border-hairline">
            <td className={cell}>{p.title}</td>
            <td className={`${cell} font-mono text-xs text-graphite`}>{p.slug}</td>
            <td className={cell}>
              <Price cents={p.priceCents} currency={p.currency} />
            </td>
            <td className={cell}>{p.stock}</td>
            <td className={cell}>{p.category?.name ?? '—'}</td>
            <td className={cell}>
              <span className={p.isActive ? 'text-ink' : 'text-graphite'}>
                {p.isActive ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td className={`${cell} space-x-3 whitespace-nowrap`}>
              <Link href={`/products/${p.id}/edit`} className={action}>
                Edit
              </Link>
              <button className={action} onClick={() => onSetActive(p.id, !p.isActive)}>
                {p.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button className={action} onClick={() => onDelete(p.id)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
