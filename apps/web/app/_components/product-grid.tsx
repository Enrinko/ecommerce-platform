import type { Product } from '@repo/types';
import { ProductCard } from './product-card';

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p className="py-16 text-center text-graphite">No products match these filters.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <div key={p.id} className="bg-paper">
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}
