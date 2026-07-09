import type { Metadata } from 'next';
import { RequireAuth } from '@/app/_components/require-auth';
import { CartView } from '@/app/_components/cart-view';
import { CheckoutForm } from '@/app/_components/checkout-form';

export const metadata: Metadata = { title: 'Checkout' };

export default function CheckoutPage() {
  return (
    <RequireAuth>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Checkout</h1>
        <div className="mt-6 grid gap-10 md:grid-cols-2">
          <section>
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-graphite">Order</h2>
            <CartView />
          </section>
          <section>
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-graphite">
              Shipping
            </h2>
            <CheckoutForm />
          </section>
        </div>
      </main>
    </RequireAuth>
  );
}
