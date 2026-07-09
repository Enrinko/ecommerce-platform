import Link from 'next/link';
import { Price } from '@repo/ui';
import type { Product } from '@repo/types';

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block rounded-md border border-hairline bg-surface transition-colors hover:border-accent"
    >
      <div className="aspect-square overflow-hidden border-b border-hairline bg-paper">
        {image ? (
          <img src={image} alt={product.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-widest text-graphite">
            no image
          </div>
        )}
      </div>
      <div className="p-4">
        {product.category && (
          <p className="font-mono text-[11px] uppercase tracking-widest text-graphite">
            {product.category.name}
          </p>
        )}
        <h3 className="mt-1 font-display text-base font-medium text-ink group-hover:text-accent">
          {product.title}
        </h3>
        <Price cents={product.priceCents} currency={product.currency} className="mt-2 block text-sm" />
      </div>
    </Link>
  );
}
