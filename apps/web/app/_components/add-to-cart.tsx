'use client';

import { Button } from '@repo/ui';
import type { Product } from '@repo/types';
import { useAuth } from './auth-provider';
import { useGuestCart } from '@/lib/guest-cart';
import { useCartMutations } from '@/lib/cart';

export function AddToCart({ product }: { product: Product }) {
  const { status } = useAuth();
  const guest = useGuestCart();
  const { add } = useCartMutations();

  function onClick() {
    if (status === 'authed') {
      add.mutate({ productId: product.id, qty: 1 });
    } else {
      guest.add({
        productId: product.id,
        slug: product.slug,
        title: product.title,
        priceCents: product.priceCents,
        currency: product.currency,
        image: product.images[0],
      });
    }
  }

  return <Button onClick={onClick}>Add to cart</Button>;
}
