import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addCartItem, getCart, removeCartItem, updateCartItem, type Cart } from '@repo/api-client';
import { API_BASE, authed } from './api';
import { useGuestCart } from './guest-cart';

export async function mergeGuestCartIntoServer(accessToken: string): Promise<void> {
  // The persisted store hydrates from AsyncStorage asynchronously; wait so the
  // merge sees the latest guest cart, not an empty pre-hydration snapshot.
  await useGuestCart.persist.rehydrate();
  const { items, clear } = useGuestCart.getState();
  for (const line of items) {
    await addCartItem(
      { productId: line.productId, qty: line.qty },
      { baseUrl: API_BASE, accessToken },
    );
  }
  clear();
}

export function useServerCart(enabled: boolean) {
  return useQuery<Cart>({
    queryKey: ['cart'],
    queryFn: () => authed((o) => getCart(o)),
    enabled,
  });
}

export function useCartMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['cart'] });
  return {
    add: useMutation({
      mutationFn: (v: { productId: string; qty: number }) => authed((o) => addCartItem(v, o)),
      onSuccess: invalidate,
    }),
    setQty: useMutation({
      mutationFn: (v: { productId: string; qty: number }) =>
        authed((o) => updateCartItem(v.productId, v.qty, o)),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (productId: string) => authed((o) => removeCartItem(productId, o)),
      onSuccess: invalidate,
    }),
  };
}
