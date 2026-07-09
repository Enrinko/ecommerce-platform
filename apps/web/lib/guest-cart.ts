import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GuestCartItem = {
  productId: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  image?: string;
  qty: number;
};

type GuestCartState = {
  items: GuestCartItem[];
  add: (item: Omit<GuestCartItem, 'qty'>, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

export const useGuestCart = create<GuestCartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, qty = 1) =>
        set((s) => {
          const line = s.items.find((i) => i.productId === item.productId);
          if (line) {
            return {
              items: s.items.map((i) =>
                i.productId === item.productId ? { ...i, qty: i.qty + qty } : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, qty }] };
        }),
      setQty: (productId, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.productId !== productId)
              : s.items.map((i) => (i.productId === productId ? { ...i, qty } : i)),
        })),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'guest-cart' },
  ),
);
