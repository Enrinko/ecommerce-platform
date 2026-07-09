import type { Product } from '@repo/types';
import { useAuth } from '@/components/auth-provider';
import { useGuestCart } from '@/lib/guest-cart';
import { useCartMutations } from '@/lib/cart';
import { Button } from '@/components/button';

export function AddToCart({ product }: { product: Product }) {
  const { status } = useAuth();
  const guest = useGuestCart();
  const { add } = useCartMutations();

  function onPress() {
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

  return <Button label="Add to cart" onPress={onPress} />;
}
