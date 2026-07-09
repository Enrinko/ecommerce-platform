import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addCartItem, getCart, removeCartItem, updateCartItem, type Cart } from '@repo/api-client';
import { authed, getAccessToken } from './auth-client';
import { useGuestCart } from './guest-cart';

export async function mergeGuestCartIntoServer(accessToken: string): Promise<void> {
  const { items, clear } = useGuestCart.getState();
  for (const line of items) {
    await addCartItem({ productId: line.productId, qty: line.qty }, { accessToken });
  }
  clear();
}

export function useServerCart(enabled: boolean) {
  return useQuery<Cart>({
    queryKey: ['cart'],
    queryFn: () => authed((opts) => getCart(opts)),
    enabled,
  });
}

export function useCartMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['cart'] });
  return {
    add: useMutation({
      mutationFn: (v: { productId: string; qty: number }) => authed((opts) => addCartItem(v, opts)),
      onSuccess: invalidate,
    }),
    setQty: useMutation({
      mutationFn: (v: { productId: string; qty: number }) =>
        authed((opts) => updateCartItem(v.productId, v.qty, opts)),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (productId: string) => authed((opts) => removeCartItem(productId, opts)),
      onSuccess: invalidate,
    }),
  };
}

export function hasAccessToken(): boolean {
  return getAccessToken() !== null;
}
