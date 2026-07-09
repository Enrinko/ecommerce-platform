# Phase 4 · M3 — Mobile Cart + Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add-to-cart → cart → checkout on mobile: a guest cart (zustand + AsyncStorage) that merges into the server cart on login, a cart screen (qty/remove/total), and an auth-gated checkout screen (rhf+zod) that places an order.

**Architecture:** Mirrors web M3/M4. Guest cart is client-side (zustand `persist` over AsyncStorage), snapshotting product display data; on login the `AuthProvider` merges it into the server cart (`addCartItem` loop) and clears it. Authed cart reads/writes go through TanStack Query over the `authed()` wrapper. `AddToCart` picks guest-vs-server by auth status. Checkout is behind a `useRequireAuth` gate; the form validates `createOrderInput` and routes to the created order (orders history screen lands in M4 — for now it routes to a confirmation placeholder / the account tab). Reuses `@repo/types`/`@repo/api-client` unchanged.

**Tech Stack:** Expo SDK 52 · Expo Router 4 · React 18.3 · zustand + AsyncStorage · TanStack Query 5 · react-hook-form + zod · Jest (`jest-expo`) + RNTL · Playwright (Expo Web).

## Global Constraints

- **Commands in `fullstack-dev-1`.** Mobile: `pnpm --filter mobile test|typecheck|lint`; E2E `CI=1 CORS_ORIGINS=http://localhost:8081 EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1 pnpm --filter mobile test:e2e` (kill stale :3000/:8081 first; after any compose recreate re-run `playwright install --with-deps chromium`).
- Contracts from `@repo/types` only (`AddCartItemInput`, `CreateOrderInput`, `Product`). `@repo/api-client`/`@repo/types` unchanged; api-client `Cart` type stays loose (`items:[{productId,qty,product:unknown}]`).
- **React isolation holds** (M1): mobile on nested react@18.3.1 via Metro `resolveRequest` + jest `moduleNameMapper`. Don't add react deps.
- **Align `@react-native-async-storage/async-storage` to `1.23.1`** (expo SDK 52's expected version) — this milestone first uses it.
- Components in `components/`, screens under `app/`, tests in `__tests__/` (Expo Router bundles every `app/**/*.tsx`). jest.mock factories use `mock`-prefixed vars or in-factory `jest.fn()`.
- Reads/writes to the cart & checkout are **auth-gated** and go through `authed()` (access token in memory; refresh in SecureStore/localStorage-E2E). Guest cart persists to AsyncStorage.
- Money is integer cents; `Price` for display. Conventional Commits; no push/PR until the milestone is done and asked.

---

## File Structure

```
apps/mobile/
├─ package.json            # UPDATE → async-storage 1.23.1
├─ jest.setup.ts           # UPDATE → AsyncStorage mock
├─ lib/
│  ├─ guest-cart.ts        # NEW → zustand + persist(AsyncStorage)          (+test)
│  ├─ cart.ts              # NEW → merge + useServerCart + useCartMutations  (+test: merge)
│  └─ orders.ts            # NEW → useCheckout
├─ components/
│  ├─ add-to-cart.tsx      # NEW (guest/server add)                          (+test)
│  └─ cart-view.tsx        # NEW (presentational: items/qty/remove/total)    (+test)
├─ __tests__/
│  ├─ guest-cart.test.ts  cart-merge.test.ts  add-to-cart.test.tsx
│  ├─ cart-view.test.tsx  checkout-screen.test.tsx
├─ app/
│  ├─ (tabs)/
│  │  ├─ cart.tsx          # UPDATE → cart screen (guest/server)
│  │  └─ shop/[slug].tsx   # UPDATE → mount <AddToCart>
│  └─ checkout.tsx         # NEW → RequireAuth gate + CheckoutForm
└─ components/auth-provider.tsx  # UPDATE → merge guest cart after login/register
apps/mobile/e2e/
└─ purchase.spec.ts        # NEW → guest add → register → checkout → order
```

Order: async-storage + guest cart (T1) → server cart + merge + AuthProvider wire (T2) → orders hook + AddToCart + product wire (T3) → CartView + cart screen (T4) → useRequireAuth + checkout screen (T5) → pipeline + purchase E2E (T6).

---

### Task 1: async-storage align + guest cart

**Files:** Modify `apps/mobile/package.json`, `apps/mobile/jest.setup.ts`; Create `apps/mobile/lib/guest-cart.ts`, `apps/mobile/__tests__/guest-cart.test.ts`.

**Interfaces (Produces):** `useGuestCart` zustand store: `{ items: GuestCartItem[]; add(item, qty?); setQty(productId, qty); remove(productId); clear() }`; `GuestCartItem = { productId, slug, title, priceCents, currency, image?, qty }`.

- [ ] **Step 1: Align async-storage + AsyncStorage mock** — in `apps/mobile/package.json` set `"@react-native-async-storage/async-storage": "1.23.1"`; run `pnpm install`. Append to `apps/mobile/jest.setup.ts`:
```ts
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
```

- [ ] **Step 2: Failing test** — `apps/mobile/__tests__/guest-cart.test.ts`:
```ts
import { useGuestCart } from '@/lib/guest-cart';

const line = {
  productId: 'p1',
  slug: 'usb-c-cable',
  title: 'USB-C Cable',
  priceCents: 2500,
  currency: 'USD',
};

beforeEach(() => useGuestCart.setState({ items: [] }));

describe('useGuestCart', () => {
  it('adds and increments quantity', () => {
    useGuestCart.getState().add(line);
    useGuestCart.getState().add(line, 2);
    const items = useGuestCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].qty).toBe(3);
  });
  it('sets quantity and removes at zero', () => {
    useGuestCart.getState().add(line);
    useGuestCart.getState().setQty('p1', 5);
    expect(useGuestCart.getState().items[0].qty).toBe(5);
    useGuestCart.getState().setQty('p1', 0);
    expect(useGuestCart.getState().items).toHaveLength(0);
  });
  it('removes and clears', () => {
    useGuestCart.getState().add(line);
    useGuestCart.getState().remove('p1');
    expect(useGuestCart.getState().items).toHaveLength(0);
    useGuestCart.getState().add(line);
    useGuestCart.getState().clear();
    expect(useGuestCart.getState().items).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run, verify fail** — `pnpm --filter mobile test guest-cart` → FAIL.

- [ ] **Step 4: Implement** — `apps/mobile/lib/guest-cart.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
      remove: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'guest-cart', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
```

- [ ] **Step 5: Run, verify pass** — `pnpm --filter mobile test guest-cart` → 3 pass.

- [ ] **Step 6: Commit** — `git add apps/mobile/lib/guest-cart.ts apps/mobile/__tests__/guest-cart.test.ts apps/mobile/jest.setup.ts apps/mobile/package.json pnpm-lock.yaml && git commit -m "feat(mobile): guest cart (zustand + AsyncStorage)"`

---

### Task 2: server cart hooks + merge + AuthProvider wire

**Files:** Create `apps/mobile/lib/cart.ts`, `apps/mobile/__tests__/cart-merge.test.ts`; Modify `apps/mobile/components/auth-provider.tsx`.

**Interfaces (Produces):**
- `mergeGuestCartIntoServer(accessToken: string): Promise<void>`
- `useServerCart(enabled: boolean)`, `useCartMutations()` → `{ add, setQty, remove }` (each a TanStack mutation over `authed`).

- [ ] **Step 1: Failing test** — `apps/mobile/__tests__/cart-merge.test.ts`:
```ts
import { addCartItem } from '@repo/api-client';

jest.mock('@repo/api-client', () => {
  const actual = jest.requireActual('@repo/api-client');
  return { ...actual, addCartItem: jest.fn().mockResolvedValue({ id: 'c1', items: [] }) };
});

import { useGuestCart } from '@/lib/guest-cart';
import { mergeGuestCartIntoServer } from '@/lib/cart';

const mockAdd = addCartItem as jest.Mock;

beforeEach(() => {
  mockAdd.mockClear();
  useGuestCart.setState({
    items: [
      { productId: 'p1', slug: 's1', title: 'A', priceCents: 100, currency: 'USD', qty: 2 },
      { productId: 'p2', slug: 's2', title: 'B', priceCents: 200, currency: 'USD', qty: 1 },
    ],
  });
});

it('posts each guest line to the server cart and clears it', async () => {
  await mergeGuestCartIntoServer('tok');
  expect(mockAdd).toHaveBeenCalledTimes(2);
  expect(mockAdd).toHaveBeenCalledWith(
    { productId: 'p1', qty: 2 },
    expect.objectContaining({ accessToken: 'tok' }),
  );
  expect(useGuestCart.getState().items).toHaveLength(0);
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter mobile test cart-merge` → FAIL.

- [ ] **Step 3: Implement** — `apps/mobile/lib/cart.ts`:
```ts
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
```

- [ ] **Step 4: Wire merge into AuthProvider** — in `apps/mobile/components/auth-provider.tsx`, import `mergeGuestCartIntoServer` and call it inside `establish` after the profile is set (login/register path), swallowing errors so a merge hiccup never blocks sign-in:
```tsx
import { mergeGuestCartIntoServer } from '@/lib/cart';
// ... in establish(), after setUser(profile)/setStatus('authed'):
await mergeGuestCartIntoServer(tokens.accessToken).catch(() => undefined);
```
(Place the merge call at the end of `establish`; silent refresh on mount does NOT merge — only explicit login/register do, matching web.)

- [ ] **Step 5: Run, verify pass** — `pnpm --filter mobile test cart-merge` → pass; `pnpm --filter mobile typecheck` clean; `pnpm --filter mobile test auth-provider` still green (merge is mocked/awaited; add `jest.mock('@/lib/cart', ...)` to the auth-provider test if it now imports it — see note).

> **Note:** `__tests__/auth-provider.test.tsx` will now transitively import `@/lib/cart`. Add at the top of that test: `jest.mock('@/lib/cart', () => ({ mergeGuestCartIntoServer: jest.fn().mockResolvedValue(undefined) }));` so the provider test stays isolated (mirrors web's `auth-provider.test`).

- [ ] **Step 6: Commit** — `git add apps/mobile/lib/cart.ts apps/mobile/__tests__/cart-merge.test.ts apps/mobile/components/auth-provider.tsx apps/mobile/__tests__/auth-provider.test.tsx && git commit -m "feat(mobile): server cart hooks + guest-cart merge on login"`

---

### Task 3: checkout hook + AddToCart + product wiring

**Files:** Create `apps/mobile/lib/orders.ts`, `apps/mobile/components/add-to-cart.tsx`, `apps/mobile/__tests__/add-to-cart.test.tsx`; Modify `apps/mobile/app/(tabs)/shop/[slug].tsx`.

**Interfaces (Produces):** `useCheckout()` (mutation over `authed(checkout)`); `AddToCart({ product })` — authed → server `add`, guest → guest `add`.

- [ ] **Step 1: orders hook** — `apps/mobile/lib/orders.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkout, type Order } from '@repo/api-client';
import type { CreateOrderInput } from '@repo/types';
import { authed } from './api';

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation<Order, unknown, CreateOrderInput>({
    mutationFn: (input) => authed((o) => checkout(input, o)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
  });
}
```

- [ ] **Step 2: Failing test** — `apps/mobile/__tests__/add-to-cart.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product } from '@repo/types';

const mockGuestAdd = jest.fn();
jest.mock('@/lib/guest-cart', () => ({ useGuestCart: () => ({ add: mockGuestAdd }) }));
const mockServerAdd = jest.fn();
jest.mock('@/lib/cart', () => ({ useCartMutations: () => ({ add: { mutate: mockServerAdd } }) }));
let mockStatus = 'guest';
jest.mock('@/components/auth-provider', () => ({ useAuth: () => ({ status: mockStatus }) }));

import { AddToCart } from '@/components/add-to-cart';

const product: Product = {
  id: 'p1',
  title: 'USB-C Cable',
  slug: 'usb-c-cable',
  description: 'd',
  priceCents: 2500,
  currency: 'USD',
  stock: 5,
  images: ['img.png'],
  isActive: true,
  categoryId: 'c1',
  createdAt: new Date('2026-01-01'),
};

beforeEach(() => {
  mockGuestAdd.mockReset();
  mockServerAdd.mockReset();
});

it('adds to the guest cart when not authed', () => {
  mockStatus = 'guest';
  render(<AddToCart product={product} />);
  fireEvent.press(screen.getByText(/add to cart/i));
  expect(mockGuestAdd).toHaveBeenCalledWith(
    expect.objectContaining({ productId: 'p1', slug: 'usb-c-cable', priceCents: 2500 }),
  );
  expect(mockServerAdd).not.toHaveBeenCalled();
});

it('adds to the server cart when authed', () => {
  mockStatus = 'authed';
  render(<AddToCart product={product} />);
  fireEvent.press(screen.getByText(/add to cart/i));
  expect(mockServerAdd).toHaveBeenCalledWith({ productId: 'p1', qty: 1 });
  expect(mockGuestAdd).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run, verify fail** — `pnpm --filter mobile test add-to-cart` → FAIL.

- [ ] **Step 4: Implement** — `apps/mobile/components/add-to-cart.tsx`:
```tsx
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
```

Mount it in `apps/mobile/app/(tabs)/shop/[slug].tsx` — add `import { AddToCart } from '@/components/add-to-cart';` and render `<View style={{ marginTop: 16 }}><AddToCart product={p} /></View>` after the description (before Reviews).

- [ ] **Step 5: Run, verify pass** — `pnpm --filter mobile test add-to-cart` → 2 pass; `pnpm --filter mobile typecheck` clean.

- [ ] **Step 6: Commit** — `git add apps/mobile/lib/orders.ts apps/mobile/components/add-to-cart.tsx apps/mobile/__tests__/add-to-cart.test.tsx "apps/mobile/app/(tabs)/shop/[slug].tsx" && git commit -m "feat(mobile): checkout hook + add-to-cart on product screen"`

---

### Task 4: CartView + cart screen

**Files:** Create `apps/mobile/components/cart-view.tsx`, `apps/mobile/__tests__/cart-view.test.tsx`; Modify `apps/mobile/app/(tabs)/cart.tsx`.

**Interfaces (Produces):** `CartView({ lines, onSetQty, onRemove, onCheckout })` where `lines: { productId; title; priceCents; currency; qty }[]` — renders rows with qty steppers, remove, a total, and a checkout button; empty state.

- [ ] **Step 1: Failing test** — `apps/mobile/__tests__/cart-view.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CartView } from '@/components/cart-view';

const lines = [
  { productId: 'p1', title: 'USB-C Cable', priceCents: 2500, currency: 'USD', qty: 2 },
  { productId: 'p2', title: 'Laptop Sleeve', priceCents: 4000, currency: 'USD', qty: 1 },
];

describe('CartView', () => {
  it('renders lines, a total, and fires remove/checkout', () => {
    const onRemove = jest.fn();
    const onCheckout = jest.fn();
    render(
      <CartView lines={lines} onSetQty={jest.fn()} onRemove={onRemove} onCheckout={onCheckout} />,
    );
    expect(screen.getByText('USB-C Cable')).toBeTruthy();
    // total = 2*2500 + 1*4000 = 9000 → $90.00
    expect(screen.getByText('$90.00')).toBeTruthy();
    fireEvent.press(screen.getAllByText(/remove/i)[0]);
    expect(onRemove).toHaveBeenCalledWith('p1');
    fireEvent.press(screen.getByText(/checkout/i));
    expect(onCheckout).toHaveBeenCalled();
  });

  it('shows an empty state', () => {
    render(<CartView lines={[]} onSetQty={jest.fn()} onRemove={jest.fn()} onCheckout={jest.fn()} />);
    expect(screen.getByText(/cart is empty/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter mobile test cart-view` → FAIL.

- [ ] **Step 3: Implement** — `apps/mobile/components/cart-view.tsx`:
```tsx
import { Pressable, Text, View } from 'react-native';
import { Price } from '@/components/price';
import { Button } from '@/components/button';

export type CartLine = {
  productId: string;
  title: string;
  priceCents: number;
  currency: string;
  qty: number;
};

export function CartView({
  lines,
  onSetQty,
  onRemove,
  onCheckout,
}: {
  lines: CartLine[];
  onSetQty: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
}) {
  if (lines.length === 0) {
    return <Text style={{ color: '#70707A', padding: 16 }}>Your cart is empty.</Text>;
  }
  const total = lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0);
  const currency = lines[0].currency;

  return (
    <View style={{ padding: 16 }}>
      {lines.map((l) => (
        <View
          key={l.productId}
          style={{ borderBottomWidth: 1, borderBottomColor: '#DAD8D1', paddingVertical: 12 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#17171B' }}>{l.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 16 }}>
            <Pressable onPress={() => onSetQty(l.productId, l.qty - 1)}>
              <Text style={{ fontSize: 18, color: '#2440F0' }}>−</Text>
            </Pressable>
            <Text style={{ minWidth: 24, textAlign: 'center' }}>{l.qty}</Text>
            <Pressable onPress={() => onSetQty(l.productId, l.qty + 1)}>
              <Text style={{ fontSize: 18, color: '#2440F0' }}>+</Text>
            </Pressable>
            <Price cents={l.priceCents * l.qty} currency={l.currency} />
            <Pressable onPress={() => onRemove(l.productId)}>
              <Text style={{ color: '#70707A' }}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <Text style={{ fontWeight: '600', color: '#17171B' }}>Total</Text>
        <Price cents={total} currency={currency} style={{ fontSize: 18, fontWeight: '600' }} />
      </View>
      <View style={{ marginTop: 16 }}>
        <Button label="Checkout" onPress={onCheckout} />
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Cart screen** — `apps/mobile/app/(tabs)/cart.tsx` (guest lines from the store; authed lines from the server cart; maps server cart's loose `product` to display fields with fallbacks):
```tsx
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/auth-provider';
import { useGuestCart } from '@/lib/guest-cart';
import { useServerCart, useCartMutations } from '@/lib/cart';
import { CartView, type CartLine } from '@/components/cart-view';

type ServerLine = { productId: string; qty: number; product: { title?: string; priceCents?: number; currency?: string } };

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
  const remove = authed
    ? (id: string) => m.remove.mutate(id)
    : (id: string) => guest.remove(id);

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
```

- [ ] **Step 5: Run, verify pass + typecheck** — `pnpm --filter mobile test cart-view` → 2 pass; `pnpm --filter mobile typecheck` clean.

- [ ] **Step 6: Commit** — `git add apps/mobile/components/cart-view.tsx apps/mobile/__tests__/cart-view.test.tsx "apps/mobile/app/(tabs)/cart.tsx" && git commit -m "feat(mobile): cart view + cart screen (guest/server)"`

---

### Task 5: RequireAuth gate + checkout screen

**Files:** Create `apps/mobile/components/require-auth.tsx`, `apps/mobile/app/checkout.tsx`, `apps/mobile/__tests__/checkout-screen.test.tsx`.

**Interfaces (Produces):** `RequireAuth({ children })` — `authed` → children, else `router.replace('/(auth)/login')` + null. Checkout screen: rhf+zod over `createOrderInput` → `useCheckout` → on success route to the order (M4 order screen; for now `/(tabs)/account`).

- [ ] **Step 1: RequireAuth** — `apps/mobile/components/require-auth.tsx`:
```tsx
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/auth-provider';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === 'guest') router.replace('/(auth)/login');
  }, [status, router]);
  if (status !== 'authed') return null;
  return <>{children}</>;
}
```

- [ ] **Step 2: Failing test** — `apps/mobile/__tests__/checkout-screen.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }));
jest.mock('@/components/auth-provider', () => ({ useAuth: () => ({ status: 'authed' }) }));
const mockMutateAsync = jest.fn();
jest.mock('@/lib/orders', () => ({ useCheckout: () => ({ mutateAsync: mockMutateAsync }) }));

import CheckoutScreen from '@/app/checkout';

beforeEach(() => {
  mockReplace.mockReset();
  mockPush.mockReset();
  mockMutateAsync.mockReset().mockResolvedValue({ id: 'order-1' });
});

it('submits shipping details and routes on success', async () => {
  render(<CheckoutScreen />);
  fireEvent.changeText(screen.getByLabelText(/name/i), 'Ada Lovelace');
  fireEvent.changeText(screen.getByLabelText(/address/i), '1 Analytical Way');
  fireEvent.press(screen.getByText(/place order/i));
  await waitFor(() =>
    expect(mockMutateAsync).toHaveBeenCalledWith({
      shippingName: 'Ada Lovelace',
      shippingAddr: '1 Analytical Way',
    }),
  );
});

it('validates required fields', async () => {
  render(<CheckoutScreen />);
  fireEvent.press(screen.getByText(/place order/i));
  await waitFor(() => expect(screen.getByText(/required|at least 1/i)).toBeTruthy());
  expect(mockMutateAsync).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run, verify fail** — `pnpm --filter mobile test checkout-screen` → FAIL.

- [ ] **Step 4: Implement** — `apps/mobile/app/checkout.tsx`:
```tsx
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { createOrderInput, type CreateOrderInput } from '@repo/types';
import { ApiError } from '@repo/api-client';
import { Field } from '@/components/field';
import { Button } from '@/components/button';
import { RequireAuth } from '@/components/require-auth';
import { useCheckout } from '@/lib/orders';

function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return 'Some items are no longer available. Please review your cart.';
    if (e.status === 400) return 'Your cart is empty.';
    return e.message;
  }
  return 'Something went wrong. Please try again.';
}

function CheckoutForm() {
  const checkout = useCheckout();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderInput) as Resolver<CreateOrderInput>,
    defaultValues: { shippingName: '', shippingAddr: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await checkout.mutateAsync(values);
      router.push('/(tabs)/account');
    } catch (e) {
      setError(messageFor(e));
    }
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#17171B', marginBottom: 24 }}>
        Checkout
      </Text>
      <Controller
        control={control}
        name="shippingName"
        render={({ field }) => (
          <Field
            label="Full name"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.shippingName?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="shippingAddr"
        render={({ field }) => (
          <Field
            label="Shipping address"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.shippingAddr?.message}
          />
        )}
      />
      {error ? <Text style={{ color: '#2440F0', marginBottom: 12 }}>{error}</Text> : null}
      <Button
        label={isSubmitting ? 'Placing…' : 'Place order'}
        onPress={onSubmit}
        disabled={isSubmitting}
      />
    </ScrollView>
  );
}

export default function CheckoutScreen() {
  return (
    <RequireAuth>
      <CheckoutForm />
    </RequireAuth>
  );
}
```

> The checkout test mocks `useAuth` → `authed`, so `RequireAuth` renders the form. `zodResolver(...) as Resolver<CreateOrderInput>` mirrors the ProductForm cast pattern (createOrderInput has no defaults, but keep the cast consistent and future-proof).

- [ ] **Step 5: Run, verify pass + typecheck** — `pnpm --filter mobile test checkout-screen` → 2 pass; `pnpm --filter mobile typecheck` clean.

- [ ] **Step 6: Commit** — `git add apps/mobile/components/require-auth.tsx apps/mobile/app/checkout.tsx apps/mobile/__tests__/checkout-screen.test.tsx && git commit -m "feat(mobile): auth-gated checkout screen"`

---

### Task 6: Pipeline + purchase E2E

**Files:** Create `apps/mobile/e2e/purchase.spec.ts`.

- [ ] **Step 1: Purchase E2E** — `apps/mobile/e2e/purchase.spec.ts` (mirror web's purchase flow on Expo Web):
```ts
import { test, expect } from '@playwright/test';

test('guest adds to cart, registers, and checks out', async ({ page }) => {
  const email = `m2e_${Date.now()}@example.com`;

  // Add a seeded in-stock product to the guest cart from its product page.
  await page.goto('/shop/usb-c-cable');
  await page.getByText(/add to cart/i).click();

  // Register (guest cart merges into the server cart on sign-up).
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill('secret123');
  await page.getByRole('button', { name: /create account/i }).click();

  // Go to checkout and place the order.
  await page.goto('/checkout');
  await page.getByLabel(/name/i).fill('E2E Buyer');
  await page.getByLabel(/address/i).fill('1 Test Way');
  await page.getByText(/place order/i).click();

  // On success the checkout routes away from /checkout (to the account tab).
  await expect(page).not.toHaveURL(/\/checkout$/);
});
```

- [ ] **Step 2: Run E2E (in-container)** — kill stale :3000/:8081 first:
```
docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; CI=1 CORS_ORIGINS=http://localhost:8081 EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1 pnpm --filter mobile test:e2e 2>&1 | tail -10"
```
Expected: 2 passed (browse + purchase). If the merge/checkout races the guest-cart rehydrate, the register→checkout navigation gives it time; keep the explicit `page.goto('/checkout')`.

- [ ] **Step 3: Workspace pipeline** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `NODE_ENV=production pnpm build` green; `pnpm --filter mobile exec expo export --platform web --output-dir /tmp/mw` succeeds; `pnpm install --frozen-lockfile` consistent.
- [ ] **Step 4: Commit** — `git add apps/mobile/e2e/purchase.spec.ts && git commit -m "test(mobile): guest → register → checkout purchase E2E"`

---

## Definition of Done (M3)

- Add-to-cart works for guests (AsyncStorage) and authed users (server); the guest cart merges into the server cart on login/register; the cart screen shows lines with qty steppers, remove, and a total; checkout is auth-gated and places an order.
- RNTL tests cover guest cart, merge, AddToCart, CartView, and the checkout screen; the Expo Web purchase E2E (guest → register → checkout) passes alongside browse.
- `lint`/`typecheck`/`test` green across the workspace; mobile bundles for web; frozen-lockfile consistent; async-storage aligned to expo's expected version. No `@repo/*`/API changes.
- Orders history (M4) still to come.

---

## Self-Review

- **Spec coverage:** §5 M3 row (guest cart zustand+AsyncStorage + merge on login; cart screen; checkout rhf+zod → order) → T1–T5; §6 (guest cart snapshot + `mergeGuestCartIntoServer`; authed cart via TanStack Query over `authed`) → T1/T2/T4; §8.2 purchase E2E → T6. §7 (checkout 409/400 friendly messages) → T5.
- **Placeholder scan:** none — full code or exact commands throughout; the one file-touch note (auth-provider test gains a `@/lib/cart` mock) states the exact line to add.
- **Type consistency:** `GuestCartItem`/`CartLine` fields align across guest-cart, merge, AddToCart, CartView, and the cart screen; `mergeGuestCartIntoServer(accessToken)` posts `{productId,qty}` with `{baseUrl,accessToken}`; `useCheckout` → `Order`; `createOrderInput` = `{shippingName,shippingAddr}`. `AddToCart` guest add omits `qty` (store defaults to 1). Server cart's loose `product` is narrowed with fallbacks in the cart screen.
- **React/bundle isolation:** no react deps; components in `components/`, tests in `__tests__/`; screen/component tests mock `expo-router`, `@/lib/*`, `@/components/auth-provider`. AuthProvider now imports `@/lib/cart` → its existing test gets a cart mock (kept isolated).
- **YAGNI:** no order-confirmation screen (M4 routes to account tab for now), no saved addresses, no quantity input field (steppers only), no optimistic cart updates.
```
