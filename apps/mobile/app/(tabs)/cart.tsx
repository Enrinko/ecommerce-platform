import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/auth-provider';
import { useGuestCart } from '@/lib/guest-cart';
import { useServerCart, useCartMutations } from '@/lib/cart';
import { CartView, type CartLine } from '@/components/cart-view';

type ServerLine = {
  productId: string;
  qty: number;
  product: { title?: string; priceCents?: number; currency?: string };
};

export default function CartScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const authed = status === 'authed';
  const guest = useGuestCart();
  const server = useServerCart(authed);
  const m = useCartMutations();

  const lines: CartLine[] = authed
    ? ((server.data?.items ?? []) as ServerLine[]).map((i) => ({
        productId: i.productId,
        title: i.product?.title ?? i.productId,
        priceCents: i.product?.priceCents ?? 0,
        currency: i.product?.currency ?? 'USD',
        qty: i.qty,
      }))
    : guest.items.map((i) => ({
        productId: i.productId,
        title: i.title,
        priceCents: i.priceCents,
        currency: i.currency,
        qty: i.qty,
      }));

  const setQty = authed
    ? (id: string, qty: number) => m.setQty.mutate({ productId: id, qty })
    : (id: string, qty: number) => guest.setQty(id, qty);
  const remove = authed ? (id: string) => m.remove.mutate(id) : (id: string) => guest.remove(id);

  return (
    <ScrollView>
      <CartView
        lines={lines}
        onSetQty={setQty}
        onRemove={remove}
        onCheckout={() => router.push('/checkout')}
      />
    </ScrollView>
  );
}
