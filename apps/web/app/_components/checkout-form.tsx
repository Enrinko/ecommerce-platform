'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { createOrderInput, type CreateOrderInput } from '@repo/types';
import { ApiError } from '@repo/api-client';
import { Button } from '@repo/ui';
import { useCheckout } from '@/lib/orders';

function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return 'Some items are no longer available. Please review your cart.';
    if (e.status === 400) return 'Your cart is empty.';
    return e.message;
  }
  return 'Something went wrong. Please try again.';
}

export function CheckoutForm() {
  const checkout = useCheckout();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrderInput>({ resolver: zodResolver(createOrderInput) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const order = await checkout.mutateAsync(values);
      router.push(`/account/orders/${order.id}`);
    } catch (e) {
      setError(messageFor(e));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="text-graphite">Full name</span>
        <input
          {...register('shippingName')}
          className="mt-1 w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-ink"
        />
        {errors.shippingName && (
          <span className="text-sm text-accent">{errors.shippingName.message}</span>
        )}
      </label>
      <label className="block text-sm">
        <span className="text-graphite">Shipping address</span>
        <textarea
          {...register('shippingAddr')}
          rows={3}
          className="mt-1 w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-ink"
        />
        {errors.shippingAddr && (
          <span className="text-sm text-accent">{errors.shippingAddr.message}</span>
        )}
      </label>
      {error && <p className="text-sm text-accent">{error}</p>}
      <Button type="submit" disabled={isSubmitting}>
        Place order
      </Button>
    </form>
  );
}
