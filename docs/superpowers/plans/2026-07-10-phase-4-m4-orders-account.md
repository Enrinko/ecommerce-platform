# Phase 4 · M4 — Mobile Orders + Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Phase 4 (and the project): an Account tab (profile + order history) and an order detail screen, with checkout routing to the created order. Pure consumption of the existing API — no API/`@repo/*` changes.

**Architecture:** Mirrors web's account/orders. `lib/orders.ts` gains `useMyOrders`/`useOrder`/`orderStatusLabel` (alongside M3's `useCheckout`). Presentational `OrdersList` and `OrderSummary` are RNTL-tested; the Account tab (`(tabs)/account/index.tsx`) and a top-level order detail screen (`app/orders/[id].tsx`, like `checkout.tsx`) are `RequireAuth`-gated and wire the hooks. Checkout routes to `/orders/[id]` on success. Reuses `@repo/types`/`@repo/api-client` unchanged (the api-client `Order` type was enriched in Phase 3 M3).

**Tech Stack:** Expo SDK 52 · Expo Router 4 · React 18.3 · TanStack Query 5 · Jest (`jest-expo`) + RNTL · Playwright (Expo Web).

## Global Constraints

- **Commands in `fullstack-dev-1`.** Mobile: `pnpm --filter mobile test|typecheck|lint`; E2E `CI=1 CORS_ORIGINS=http://localhost:8081 EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1 pnpm --filter mobile test:e2e` (kill stale :3000/:8081 first; after any compose recreate re-run `playwright install --with-deps chromium`).
- Contracts from `@repo/types`/`@repo/api-client` only, unchanged. `Order` (api-client) = `{ id, status, totalCents, currency, shippingName, shippingAddr, createdAt, items: OrderItem[], payment?, user? }`; `OrderItem = { id, productId, titleSnapshot, priceCentsSnapshot, qty }`; `OrderList = { items: Order[], total, page, limit }`.
- **React isolation holds** (M1): mobile on nested react@18.3.1; **Metro `unstable_conditionNames=['require','react-native']`** (M3) — don't regress it. No react deps added.
- Components in `components/`, screens under `app/`, tests in `__tests__/` (Expo Router bundles every `app/**/*.tsx`). Screen tests mock `expo-router`, `@/lib/*`, `@/components/auth-provider`. jest.mock factories use `mock`-prefixed vars or in-factory `jest.fn()`.
- Order reads are auth-gated via `authed()`. Money is integer cents; `Price` for display. Conventional Commits; no push/PR until the milestone is done and asked.

---

## File Structure

```
apps/mobile/
├─ lib/orders.ts             # UPDATE → useMyOrders / useOrder / orderStatusLabel
├─ components/
│  ├─ orders-list.tsx        # NEW (presentational)                  (+test)
│  └─ order-summary.tsx      # NEW (presentational)                  (+test)
├─ app/
│  ├─ (tabs)/account/index.tsx  # UPDATE → profile + order history (RequireAuth)
│  ├─ orders/[id].tsx        # NEW → order detail (RequireAuth)
│  └─ checkout.tsx           # UPDATE → route to /orders/[id] on success
└─ __tests__/
   ├─ orders-list.test.tsx  order-summary.test.tsx
   ├─ account-screen.test.tsx  order-detail-screen.test.tsx
apps/mobile/e2e/
└─ purchase.spec.ts          # UPDATE → assert order detail after checkout
```

Order: orders hooks (T1) → OrdersList (T2) → OrderSummary (T3) → Account tab (T4) → order detail + checkout route (T5) → pipeline + E2E (T6).

---

### Task 1: orders hooks

**Files:** Modify `apps/mobile/lib/orders.ts`.

**Interfaces (Produces):** `useMyOrders(page?)` → `OrderList`; `useOrder(id)` → `Order`; `orderStatusLabel(status): string`.

- [ ] **Step 1: Implement** — extend `apps/mobile/lib/orders.ts` (keep the existing `useCheckout`), adding imports and:
```ts
import { checkout, getOrder, listMyOrders, type Order, type OrderList } from '@repo/api-client';
// ... existing useCheckout ...

const LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export function orderStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function useMyOrders(page = 1) {
  return useQuery<OrderList>({
    queryKey: ['orders', page],
    queryFn: () => authed((o) => listMyOrders({ page }, o)),
  });
}

export function useOrder(id: string) {
  return useQuery<Order>({
    queryKey: ['order', id],
    queryFn: () => authed((o) => getOrder(id, o)),
    enabled: Boolean(id),
  });
}
```
Also add `useQuery` to the `@tanstack/react-query` import and have `useCheckout` invalidate `['orders']` too:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// in useCheckout onSuccess:
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ['cart'] });
  qc.invalidateQueries({ queryKey: ['orders'] });
},
```

- [ ] **Step 2: Verify** — `pnpm --filter mobile typecheck` clean (screens consume these next).

- [ ] **Step 3: Commit** — `git add apps/mobile/lib/orders.ts && git commit -m "feat(mobile): my-orders + order hooks"`

---

### Task 2: `OrdersList` presentational

**Files:** Create `apps/mobile/components/orders-list.tsx`, `apps/mobile/__tests__/orders-list.test.tsx`.

**Interfaces (Produces):** `OrdersList({ orders, onOpen })` where `orders: { id; status; totalCents; currency }[]` — a row per order (short id, status label, `Price`), pressable → `onOpen(id)`; empty state.

- [ ] **Step 1: Failing test** — `apps/mobile/__tests__/orders-list.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OrdersList } from '@/components/orders-list';

const orders = [
  { id: 'abcdef12-0000-0000-0000-000000000000', status: 'PAID', totalCents: 2500, currency: 'USD' },
];

describe('OrdersList', () => {
  it('renders orders with status + price and opens one', () => {
    const onOpen = jest.fn();
    render(<OrdersList orders={orders} onOpen={onOpen} />);
    expect(screen.getByText('abcdef12')).toBeTruthy();
    expect(screen.getByText('Paid')).toBeTruthy();
    expect(screen.getByText('$25.00')).toBeTruthy();
    fireEvent.press(screen.getByText('abcdef12'));
    expect(onOpen).toHaveBeenCalledWith('abcdef12-0000-0000-0000-000000000000');
  });

  it('shows an empty state', () => {
    render(<OrdersList orders={[]} onOpen={jest.fn()} />);
    expect(screen.getByText(/no orders/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter mobile test orders-list` → FAIL.

- [ ] **Step 3: Implement** — `apps/mobile/components/orders-list.tsx`:
```tsx
import { Pressable, Text, View } from 'react-native';
import { Price } from '@/components/price';
import { orderStatusLabel } from '@/lib/orders';

export type OrderRow = { id: string; status: string; totalCents: number; currency: string };

export function OrdersList({
  orders,
  onOpen,
}: {
  orders: OrderRow[];
  onOpen: (id: string) => void;
}) {
  if (orders.length === 0) {
    return <Text style={{ color: '#70707A', padding: 16 }}>You have no orders yet.</Text>;
  }
  return (
    <View>
      {orders.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onOpen(o.id)}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: '#DAD8D1',
          }}
        >
          <Text style={{ fontFamily: 'monospace', color: '#70707A' }}>{o.id.slice(0, 8)}</Text>
          <Text style={{ fontSize: 12, textTransform: 'uppercase', color: '#17171B' }}>
            {orderStatusLabel(o.status)}
          </Text>
          <Price cents={o.totalCents} currency={o.currency} />
        </Pressable>
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter mobile test orders-list` → 2 pass.

- [ ] **Step 5: Commit** — `git add apps/mobile/components/orders-list.tsx apps/mobile/__tests__/orders-list.test.tsx && git commit -m "feat(mobile): orders list component"`

---

### Task 3: `OrderSummary` presentational

**Files:** Create `apps/mobile/components/order-summary.tsx`, `apps/mobile/__tests__/order-summary.test.tsx`.

**Interfaces (Produces):** `OrderSummary({ order })` — status label, items (title snapshot × qty, line price), total, shipping.

- [ ] **Step 1: Failing test** — `apps/mobile/__tests__/order-summary.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';
import type { Order } from '@repo/api-client';
import { OrderSummary } from '@/components/order-summary';

const order: Order = {
  id: 'abcdef12-0000-0000-0000-000000000000',
  status: 'PAID',
  totalCents: 5000,
  currency: 'USD',
  shippingName: 'Ada Lovelace',
  shippingAddr: '1 Analytical Way',
  createdAt: '2026-02-01T00:00:00.000Z',
  items: [
    { id: 'i1', productId: 'p1', titleSnapshot: 'USB-C Cable', priceCentsSnapshot: 2500, qty: 2 },
  ],
};

describe('OrderSummary', () => {
  it('renders status, items, total, and shipping', () => {
    render(<OrderSummary order={order} />);
    expect(screen.getByText('Paid')).toBeTruthy();
    expect(screen.getByText(/USB-C Cable/)).toBeTruthy();
    expect(screen.getByText('$50.00')).toBeTruthy(); // total
    expect(screen.getByText(/Ada Lovelace/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter mobile test order-summary` → FAIL.

- [ ] **Step 3: Implement** — `apps/mobile/components/order-summary.tsx`:
```tsx
import { Text, View } from 'react-native';
import type { Order } from '@repo/api-client';
import { Price } from '@/components/price';
import { orderStatusLabel } from '@/lib/orders';

export function OrderSummary({ order }: { order: Order }) {
  return (
    <View style={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: 'monospace', color: '#70707A' }}>{order.id.slice(0, 8)}</Text>
        <Text style={{ fontSize: 12, textTransform: 'uppercase', color: '#17171B' }}>
          {orderStatusLabel(order.status)}
        </Text>
      </View>

      <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#DAD8D1' }}>
        {order.items.map((it) => (
          <View
            key={it.id}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#DAD8D1',
            }}
          >
            <Text style={{ color: '#17171B' }}>
              {it.titleSnapshot} × {it.qty}
            </Text>
            <Price cents={it.priceCentsSnapshot * it.qty} currency={order.currency} />
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <Text style={{ fontWeight: '600', color: '#17171B' }}>Total</Text>
        <Price cents={order.totalCents} currency={order.currency} style={{ fontWeight: '600' }} />
      </View>

      <Text style={{ marginTop: 16, color: '#70707A' }}>
        Ship to: {order.shippingName}, {order.shippingAddr}
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter mobile test order-summary` → 1 pass.

- [ ] **Step 5: Commit** — `git add apps/mobile/components/order-summary.tsx apps/mobile/__tests__/order-summary.test.tsx && git commit -m "feat(mobile): order summary component"`

---

### Task 4: Account tab (profile + order history)

**Files:** Modify `apps/mobile/app/(tabs)/account/index.tsx`; Test `apps/mobile/__tests__/account-screen.test.tsx`.

**Interfaces (Consumes):** `RequireAuth`, `useAuth` (email/logout), `useMyOrders` (T1), `OrdersList` (T2), `useRouter`.

- [ ] **Step 1: Failing test** — `apps/mobile/__tests__/account-screen.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
const mockLogout = jest.fn();
jest.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ status: 'authed', user: { email: 'buyer@example.com' }, logout: mockLogout }),
}));
jest.mock('@/components/require-auth', () => ({ RequireAuth: ({ children }: any) => children }));
const mockUseMyOrders = jest.fn();
jest.mock('@/lib/orders', () => ({
  useMyOrders: (...a: unknown[]) => mockUseMyOrders(...a),
  orderStatusLabel: (s: string) => s,
}));

import AccountScreen from '@/app/(tabs)/account/index';

beforeEach(() => {
  mockPush.mockReset();
  mockLogout.mockReset();
  mockUseMyOrders.mockReturnValue({
    data: {
      items: [
        { id: 'order-1234-5678', status: 'PAID', totalCents: 2500, currency: 'USD' },
      ],
      total: 1,
      page: 1,
      limit: 20,
    },
    isLoading: false,
  });
});

it('shows the email, orders, and opens an order', () => {
  render(<AccountScreen />);
  expect(screen.getByText('buyer@example.com')).toBeTruthy();
  fireEvent.press(screen.getByText('order-12'));
  expect(mockPush).toHaveBeenCalledWith('/orders/order-1234-5678');
});

it('logs out', () => {
  render(<AccountScreen />);
  fireEvent.press(screen.getByText(/log out/i));
  expect(mockLogout).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter mobile test account-screen` → FAIL.

- [ ] **Step 3: Implement** — `apps/mobile/app/(tabs)/account/index.tsx`:
```tsx
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/auth-provider';
import { RequireAuth } from '@/components/require-auth';
import { useMyOrders } from '@/lib/orders';
import { OrdersList } from '@/components/orders-list';

function Account() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const orders = useMyOrders();

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'monospace', fontSize: 13, color: '#70707A' }}>
          {user?.email}
        </Text>
        <Pressable onPress={() => logout()}>
          <Text style={{ color: '#2440F0' }}>Log out</Text>
        </Pressable>
      </View>

      <Text style={{ marginTop: 24, fontSize: 18, fontWeight: '700', color: '#17171B' }}>
        Your orders
      </Text>
      {orders.isLoading ? (
        <Text style={{ marginTop: 12, color: '#70707A' }}>Loading…</Text>
      ) : (
        <View style={{ marginTop: 8 }}>
          <OrdersList
            orders={orders.data?.items ?? []}
            onOpen={(id) => router.push(`/orders/${id}`)}
          />
        </View>
      )}
    </ScrollView>
  );
}

export default function AccountScreen() {
  return (
    <RequireAuth>
      <Account />
    </RequireAuth>
  );
}
```

- [ ] **Step 4: Run, verify pass + typecheck** — `pnpm --filter mobile test account-screen` → 2 pass; `pnpm --filter mobile typecheck` clean.

- [ ] **Step 5: Commit** — `git add "apps/mobile/app/(tabs)/account/index.tsx" apps/mobile/__tests__/account-screen.test.tsx && git commit -m "feat(mobile): account tab with profile + order history"`

---

### Task 5: Order detail screen + checkout route

**Files:** Create `apps/mobile/app/orders/[id].tsx`, `apps/mobile/__tests__/order-detail-screen.test.tsx`; Modify `apps/mobile/app/checkout.tsx`.

**Interfaces (Consumes):** `RequireAuth`, `useOrder` (T1), `OrderSummary` (T3), `useLocalSearchParams`.

- [ ] **Step 1: Failing test** — `apps/mobile/__tests__/order-detail-screen.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';
import type { Order } from '@repo/api-client';

let mockParams: Record<string, string> = { id: 'order-1' };
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('@/components/require-auth', () => ({ RequireAuth: ({ children }: any) => children }));
const mockUseOrder = jest.fn();
jest.mock('@/lib/orders', () => ({
  useOrder: (...a: unknown[]) => mockUseOrder(...a),
  orderStatusLabel: (s: string) => s,
}));

import OrderDetailScreen from '@/app/orders/[id]';

const order: Order = {
  id: 'order-1',
  status: 'PAID',
  totalCents: 2500,
  currency: 'USD',
  shippingName: 'Ada',
  shippingAddr: '1 Way',
  createdAt: '2026-02-01T00:00:00.000Z',
  items: [{ id: 'i1', productId: 'p1', titleSnapshot: 'USB-C Cable', priceCentsSnapshot: 2500, qty: 1 }],
};

beforeEach(() => {
  mockParams = { id: 'order-1' };
});

it('renders the order summary', () => {
  mockUseOrder.mockReturnValue({ data: order, isLoading: false, isError: false });
  render(<OrderDetailScreen />);
  expect(screen.getByText(/USB-C Cable/)).toBeTruthy();
  expect(screen.getByText('$25.00')).toBeTruthy();
});

it('shows a not-found state', () => {
  mockUseOrder.mockReturnValue({ data: undefined, isLoading: false, isError: true });
  render(<OrderDetailScreen />);
  expect(screen.getByText(/not found/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter mobile test order-detail-screen` → FAIL.

- [ ] **Step 3: Implement** — `apps/mobile/app/orders/[id].tsx`:
```tsx
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useOrder } from '@/lib/orders';
import { OrderSummary } from '@/components/order-summary';
import { RequireAuth } from '@/components/require-auth';

function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);

  if (order.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (order.isError || !order.data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#70707A' }}>Order not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#17171B', padding: 16, paddingBottom: 0 }}>
        Order confirmed
      </Text>
      <OrderSummary order={order.data} />
    </ScrollView>
  );
}

export default function OrderDetailScreen() {
  return (
    <RequireAuth>
      <OrderDetail />
    </RequireAuth>
  );
}
```

- [ ] **Step 4: Checkout route** — in `apps/mobile/app/checkout.tsx`, change the success navigation from `router.push('/(tabs)/account')` to route to the created order:
```tsx
const order = await checkout.mutateAsync(values);
router.push(`/orders/${order.id}`);
```
(The `checkout.mutateAsync` already returns the `Order`; capture it and use its `id`.)

- [ ] **Step 5: Run, verify pass + typecheck** — `pnpm --filter mobile test order-detail-screen checkout-screen` → all pass (checkout test asserts `mutateAsync` called; its mock returns `{ id: 'order-1' }`, so the new `router.push('/orders/order-1')` is consistent — update the checkout test's success assertion if it checked the old route). `pnpm --filter mobile typecheck` clean.

> **Note:** `__tests__/checkout-screen.test.tsx` "submits …and routes on success" asserts `mutateAsync` was called; the route target changed to `/orders/<id>`. If that test asserts a specific `push` target, update it to `expect(mockPush).toHaveBeenCalledWith('/orders/order-1')`; otherwise it stays green.

- [ ] **Step 6: Commit** — `git add apps/mobile/app/orders apps/mobile/app/checkout.tsx apps/mobile/__tests__/order-detail-screen.test.tsx apps/mobile/__tests__/checkout-screen.test.tsx && git commit -m "feat(mobile): order detail screen + checkout routes to order"`

---

### Task 6: Pipeline + purchase E2E

**Files:** Modify `apps/mobile/e2e/purchase.spec.ts`.

- [ ] **Step 1: Extend purchase E2E** — after placing the order, assert the order detail renders. Replace the final assertion in `apps/mobile/e2e/purchase.spec.ts`:
```ts
  await page.getByText(/place order/i).click();

  // Lands on the order detail (confirmation).
  await expect(page).toHaveURL(/\/orders\/.+/);
  await expect(page.getByText(/order confirmed/i)).toBeVisible();
```

- [ ] **Step 2: Run E2E (in-container)** — kill stale :3000/:8081 first:
```
docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; CI=1 CORS_ORIGINS=http://localhost:8081 EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1 pnpm --filter mobile test:e2e 2>&1 | tail -8"
```
Expected: 2 passed (browse + purchase).

- [ ] **Step 3: Workspace pipeline** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `NODE_ENV=production pnpm build` green; `pnpm --filter mobile exec expo export --platform web --output-dir /tmp/mw` succeeds; `pnpm install --frozen-lockfile` consistent.
- [ ] **Step 4: Commit** — `git add apps/mobile/e2e/purchase.spec.ts && git commit -m "test(mobile): purchase E2E asserts order confirmation"`

---

## Definition of Done (M4 / Phase 4)

- Account tab shows the signed-in email, a logout control, and order history; tapping an order opens its detail; checkout routes to the created order's detail ("Order confirmed" + summary).
- RNTL tests cover OrdersList, OrderSummary, the Account tab, and the order detail screen; the Expo Web purchase E2E ends on the order detail.
- `lint`/`typecheck`/`test` green across the workspace; mobile bundles for web; frozen-lockfile consistent. No `@repo/*`/API changes. **Phase 4 (mobile) COMPLETE → the 4-phase project is complete.**

---

## Self-Review

- **Spec coverage:** §5 M4 row (account tab: order history + detail) → T2–T5; §7 route `app/orders/[id]` reachable from account + checkout → T4/T5; §8.2 purchase E2E ending on the order → T6. §6 (auth-gated reads via `authed`) → T1.
- **Placeholder scan:** none — full code or exact commands. The one cross-task touch (checkout test's route assertion) is called out with the exact expectation.
- **Type consistency:** `useMyOrders` → `OrderList` (`.items` → `OrderRow`-compatible `{id,status,totalCents,currency}`); `useOrder` → `Order` consumed by `OrderSummary` (`items` with `titleSnapshot`/`priceCentsSnapshot`/`qty`). `OrdersList.onOpen(id)` ↔ account screen `router.push('/orders/'+id)`. Checkout `mutateAsync` returns `Order` → `order.id`. `orderStatusLabel` shared by OrdersList/OrderSummary.
- **React/bundle isolation:** no react deps; components in `components/`, tests in `__tests__/`; screen tests mock router/auth/hooks and `RequireAuth`.
- **YAGNI:** no order pagination UI (page 1), no cancel-order action (admin-only), no address book, no push notifications — read-only history + detail.
```
