import type { Metadata } from 'next';
import { CartView } from '@/app/_components/cart-view';

export const metadata: Metadata = { title: 'Cart' };

export default function CartPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Your cart</h1>
      <div className="mt-6">
        <CartView />
      </div>
    </main>
  );
}
