# Phase 2 · M4 — Checkout + Order History + E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the purchase loop — an authed shopper checks out their cart, sees the created order, and browses order history — and prove the whole path with a Playwright end-to-end test. Final milestone of Phase 2.

**Architecture:** Checkout and account pages are client components gated behind auth (guests are redirected to `/login`). Checkout submits `POST /orders` through the authed api-client; the created order's detail page doubles as the confirmation. Order history/detail read the server via TanStack Query. A Playwright project drives a real browser through catalog → cart → login → checkout against the live API + web. Reuses the "Measured" identity.

**Tech Stack:** Next.js 15 · `@repo/api-client` (`checkout`, `listMyOrders`, `getOrder`) · `@repo/types` (`createOrderInput`) · TanStack Query · react-hook-form + zod · @playwright/test.

## Global Constraints

- Reuse **Measured** tokens/components (paper/ink/graphite/hairline + cobalt; Space Grotesk/Inter/IBM Plex Mono; `Price`, `Button`, `.ruler`). No new visual direction.
- Contracts from `@repo/types` only: `createOrderInput` (`{ shippingName, shippingAddr }`) for the checkout form; `pageQuery` for order history. Money always via `Price` (mono).
- Checkout + account pages require auth: a client `RequireAuth` redirects `status === 'guest'` to `/login` and renders nothing while `loading`.
- Checkout error handling: `409` (out of stock / cart changed) and `400` (empty cart) surface a readable message and refetch the cart; success routes to `/account/orders/[id]`.
- Order-mutation success invalidates both `['cart']` and `['orders']` query keys.
- Playwright lives in `apps/web/e2e/**` and must be excluded from Vitest (`test.exclude`); Vitest specs stay out of `e2e/`. Playwright drives the app via a `webServer` array (API + web) with a `globalSetup` that migrates+seeds.
- Commands run in `fullstack-dev-1`. Local production build uses `NODE_ENV=production pnpm --filter web build`; `next dev` (used by Playwright's webServer) runs fine under the container's `NODE_ENV=development`. `lint`/`typecheck`/unit `test` run without the override.
- New dep: `@playwright/test` in `apps/web`; browser binaries via `npx playwright install --with-deps chromium`.
- Conventional Commits; no push/PR until asked.

---

## File Structure

```
apps/web/
├─ lib/
│  ├─ orders.ts               # NEW → useCheckout / useMyOrders / useOrder + orderStatusLabel  (+test)
│  └─ orders.test.ts
├─ app/
│  ├─ _components/
│  │  ├─ require-auth.tsx      # NEW (client) → redirect guests to /login                        (+test)
│  │  ├─ checkout-form.tsx     # NEW (client) → shipping form + submit                           (+test)
│  │  └─ order-summary.tsx     # NEW (client) → order lines + status + total (shared by detail)
│  ├─ checkout/page.tsx        # NEW → RequireAuth + cart summary + CheckoutForm
│  ├─ account/orders/page.tsx        # NEW → order history list
│  ├─ account/orders/[id]/page.tsx   # NEW → order detail / confirmation
│  ├─ _components/cart-view.tsx      # UPDATE → "Checkout" link when non-empty
│  └─ _components/header-account.tsx # UPDATE → "Orders" link when authed
├─ e2e/
│  ├─ purchase.spec.ts         # NEW → guest → cart → register → checkout → order PAID
│  └─ global-setup.ts          # NEW → migrate + seed before the run
├─ playwright.config.ts        # NEW
├─ vitest.config.ts            # UPDATE → exclude e2e/**
.github/workflows/ci.yml       # UPDATE → Playwright e2e job
```

Order: order hooks (T1) → RequireAuth (T2) → checkout page/form (T3) → order history + detail (T4) → wire links (T5) → Playwright setup + spec (T6) → CI job (T7) → pipeline + verify (T8).

---

### Task 1: Order hooks + status label (`lib/orders.ts`, TDD)

**Files:** Create `apps/web/lib/orders.ts`, `apps/web/lib/orders.test.ts`.

**Interfaces:**
- `orderStatusLabel(status: string): string` — maps API status to display text: `PENDING→'Pending'`, `PAID→'Paid'`, `SHIPPED→'Shipped'`, `DELIVERED→'Delivered'`, `CANCELLED→'Cancelled'`; unknown → the raw value.
- `useCheckout()` — mutation: `authed((o) => checkout(input, o))`; on success invalidate `['cart']` and `['orders']`.
- `useMyOrders(page?)` — query `['orders', page]`: `authed((o) => listMyOrders({ page }, o))`, enabled when authed.
- `useOrder(id)` — query `['order', id]`: `authed((o) => getOrder(id, o))`.

- [ ] **Step 1: Failing test (status label — the only pure logic)**

`apps/web/lib/orders.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { orderStatusLabel } from './orders';

describe('orderStatusLabel', () => {
  it('maps known statuses to display text', () => {
    expect(orderStatusLabel('PAID')).toBe('Paid');
    expect(orderStatusLabel('CANCELLED')).toBe('Cancelled');
  });
  it('passes through unknown values', () => {
    expect(orderStatusLabel('WAT')).toBe('WAT');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter web test` FAIL (module missing).

- [ ] **Step 3: Implement**

`apps/web/lib/orders.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkout, getOrder, listMyOrders } from '@repo/api-client';
import type { CreateOrderInput } from '@repo/types';
import { authed } from './auth-client';

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

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => authed((o) => checkout(input, o)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useMyOrders(page = 1) {
  return useQuery({
    queryKey: ['orders', page],
    queryFn: () => authed((o) => listMyOrders({ page }, o)),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => authed((o) => getOrder(id, o)),
  });
}
```

- [ ] **Step 4: Run, verify pass** — green.

- [ ] **Step 5: Commit** — `git add apps/web/lib/orders.ts apps/web/lib/orders.test.ts && git commit -m "feat(web): order hooks and status label"`

---

### Task 2: RequireAuth guard (client, TDD)

**Files:** Create `apps/web/app/_components/require-auth.tsx`, `apps/web/app/_components/require-auth.test.tsx`.

**Interfaces:**
- `RequireAuth({ children })` — uses `useAuth()`: `guest` → `useRouter().replace('/login')` + render nothing; `loading` → render nothing; `authed` → render children.

- [ ] **Step 1: Failing test**

`apps/web/app/_components/require-auth.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const useAuth = vi.fn();
vi.mock('./auth-provider', () => ({ useAuth: () => useAuth() }));

import { RequireAuth } from './require-auth';

describe('RequireAuth', () => {
  it('renders children when authed', () => {
    useAuth.mockReturnValue({ status: 'authed' });
    render(<RequireAuth><p>secret</p></RequireAuth>);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
  it('redirects guests to /login', () => {
    useAuth.mockReturnValue({ status: 'guest' });
    render(<RequireAuth><p>secret</p></RequireAuth>);
    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail** — FAIL.

- [ ] **Step 3: Implement**

`apps/web/app/_components/require-auth.tsx`:
```tsx
'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'guest') router.replace('/login');
  }, [status, router]);

  if (status !== 'authed') return null;
  return <>{children}</>;
}
```

- [ ] **Step 4: Run, verify pass** — green.

- [ ] **Step 5: Commit** — `git add apps/web/app/_components/require-auth.tsx apps/web/app/_components/require-auth.test.tsx && git commit -m "feat(web): RequireAuth client guard"`

---

### Task 3: Checkout page + form

**Files:** Create `apps/web/app/_components/checkout-form.tsx`, `apps/web/app/checkout/page.tsx`. Test: `apps/web/app/_components/checkout-form.test.tsx`.

**Interfaces:**
- `CheckoutForm()` (client) — `createOrderInput` fields (shippingName, shippingAddr) via rhf+zod; on submit `useCheckout().mutateAsync` → success `router.push('/account/orders/' + order.id)`; on `ApiError` show message (409 → "Some items are no longer available", 400 → "Your cart is empty", else `e.message`).
- `/checkout` page — `RequireAuth` wrapping a cart summary (`useServerCart`) + `CheckoutForm`.

- [ ] **Step 1: Failing test**

`apps/web/app/_components/checkout-form.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/orders', () => ({ useCheckout: () => ({ mutateAsync: vi.fn() }) }));

import { CheckoutForm } from './checkout-form';

describe('CheckoutForm', () => {
  it('renders shipping fields and a place-order button', () => {
    render(<CheckoutForm />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /place order/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail** — FAIL.

- [ ] **Step 3: Implement**

`apps/web/app/_components/checkout-form.tsx`:
```tsx
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
```

`apps/web/app/checkout/page.tsx`:
```tsx
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
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-graphite">Shipping</h2>
            <CheckoutForm />
          </section>
        </div>
      </main>
    </RequireAuth>
  );
}
```

- [ ] **Step 4: Run tests + gates** — `pnpm --filter web test`; `typecheck`; `lint`.

- [ ] **Step 5: Commit** — `git add apps/web/app/_components/checkout-form.tsx apps/web/app/_components/checkout-form.test.tsx apps/web/app/checkout && git commit -m "feat(web): checkout page and shipping form"`

---

### Task 4: Order history + detail

**Files:** Create `apps/web/app/_components/order-summary.tsx`, `apps/web/app/account/orders/page.tsx`, `apps/web/app/account/orders/[id]/page.tsx`.

**Interfaces:**
- `OrderSummary({ order })` (client) — status (`orderStatusLabel`), created date, line items (titleSnapshot × qty, `Price`), total. Loosely-typed order from api-client (`items` cast to `{ titleSnapshot; priceCentsSnapshot; qty }[]`).
- `/account/orders` — `RequireAuth` + `useMyOrders`: list of orders (id short, status, total, link to detail); empty state.
- `/account/orders/[id]` — `RequireAuth` + `useOrder(id)`: `OrderSummary`; loading + not-found states. Serves as checkout confirmation.

- [ ] **Step 1: Implement `OrderSummary`**

`apps/web/app/_components/order-summary.tsx`:
```tsx
'use client';

import { Price } from '@repo/ui';
import { orderStatusLabel } from '@/lib/orders';

type OrderItem = { titleSnapshot: string; priceCentsSnapshot: number; qty: number };
type Order = { id: string; status: string; totalCents: number; currency: string; items: unknown[] };

export function OrderSummary({ order }: { order: Order }) {
  const items = order.items as OrderItem[];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-graphite">
          Order {order.id.slice(0, 8)}
        </span>
        <span className="rounded-sm border border-hairline px-2 py-1 font-mono text-xs uppercase tracking-widest text-ink">
          {orderStatusLabel(order.status)}
        </span>
      </div>
      <ul className="divide-y divide-hairline border-y border-hairline">
        {items.map((i, idx) => (
          <li key={idx} className="flex items-center justify-between py-3">
            <span className="text-ink">
              {i.titleSnapshot} <span className="text-graphite">× {i.qty}</span>
            </span>
            <Price cents={i.priceCentsSnapshot * i.qty} currency={order.currency} />
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-hairline pt-3">
        <span className="font-mono text-sm uppercase tracking-widest text-graphite">Total</span>
        <Price cents={order.totalCents} currency={order.currency} className="text-lg" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Order history list**

`apps/web/app/account/orders/page.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { Price } from '@repo/ui';
import { RequireAuth } from '@/app/_components/require-auth';
import { useMyOrders, orderStatusLabel } from '@/lib/orders';

function OrderList() {
  const { data, isLoading } = useMyOrders();
  if (isLoading) return <p className="text-graphite">Loading…</p>;
  const orders = data?.items ?? [];
  if (orders.length === 0) return <p className="text-graphite">You have no orders yet.</p>;
  return (
    <ul className="divide-y divide-hairline border-y border-hairline">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/account/orders/${o.id}`} className="flex items-center justify-between py-4 hover:text-accent">
            <span className="font-mono text-sm text-graphite">{o.id.slice(0, 8)}</span>
            <span className="font-mono text-xs uppercase tracking-widest text-ink">{orderStatusLabel(o.status)}</span>
            <Price cents={o.totalCents} currency={o.currency} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Your orders</h1>
        <div className="mt-6">
          <OrderList />
        </div>
      </main>
    </RequireAuth>
  );
}
```

- [ ] **Step 3: Order detail**

`apps/web/app/account/orders/[id]/page.tsx`:
```tsx
'use client';

import { use } from 'react';
import { RequireAuth } from '@/app/_components/require-auth';
import { OrderSummary } from '@/app/_components/order-summary';
import { useOrder } from '@/lib/orders';

function OrderDetail({ id }: { id: string }) {
  const { data: order, isLoading, isError } = useOrder(id);
  if (isLoading) return <p className="text-graphite">Loading…</p>;
  if (isError || !order) return <p className="text-graphite">Order not found.</p>;
  return (
    <>
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Order confirmed</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Thank you</h1>
      <div className="mt-6">
        <OrderSummary order={order} />
      </div>
    </>
  );
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <OrderDetail id={id} />
      </main>
    </RequireAuth>
  );
}
```

- [ ] **Step 4: Gates** — `typecheck`; `lint`; `NODE_ENV=production pnpm --filter web build`.

- [ ] **Step 5: Commit** — `git add apps/web/app/_components/order-summary.tsx apps/web/app/account && git commit -m "feat(web): order history and order detail/confirmation"`

---

### Task 5: Wire checkout + orders links

**Files:** Modify `apps/web/app/_components/cart-view.tsx`, `apps/web/app/_components/header-account.tsx`.

- [ ] **Step 1: Cart → Checkout link**

In `cart-view.tsx`, after the total block (only when `lines.length > 0`), add:
```tsx
      <Link
        href="/checkout"
        className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent/90"
      >
        Checkout
      </Link>
```
Add `import Link from 'next/link';` at the top.

- [ ] **Step 2: Header → Orders link (authed)**

In `header-account.tsx`, inside the `status === 'authed'` branch, before the email span, add:
```tsx
          <Link href="/account/orders" className="text-graphite hover:text-accent">
            Orders
          </Link>
```
(`Link` is already imported.)

- [ ] **Step 3: Gates** — `typecheck`; `lint`; `pnpm --filter web test`.

- [ ] **Step 4: Commit** — `git add apps/web/app/_components && git commit -m "feat(web): checkout and orders navigation"`

---

### Task 6: Playwright setup + purchase-flow E2E

**Files:** Create `apps/web/playwright.config.ts`, `apps/web/e2e/global-setup.ts`, `apps/web/e2e/purchase.spec.ts`. Modify `apps/web/vitest.config.ts` (exclude `e2e/**`), `apps/web/package.json` (`test:e2e` script). Install `@playwright/test` + chromium.

- [ ] **Step 1: Install** — `pnpm --filter web add -D @playwright/test`; then `docker exec fullstack-dev-1 sh -c "cd /app && npx playwright install --with-deps chromium"`.

- [ ] **Step 2: Exclude e2e from Vitest**

`apps/web/vitest.config.ts` — add `exclude` (keep defaults + e2e):
```ts
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
  },
```

- [ ] **Step 3: Playwright config**

`apps/web/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  use: { baseURL: 'http://localhost:3001', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './e2e/global-setup.ts',
  webServer: [
    {
      command: 'pnpm --filter api start:dev',
      url: 'http://localhost:3000/api/v1/health',
      timeout: 120_000,
      reuseExistingServer: true,
    },
    {
      command: 'pnpm --filter web dev',
      url: 'http://localhost:3001',
      timeout: 120_000,
      reuseExistingServer: true,
    },
  ],
});
```

`apps/web/e2e/global-setup.ts`:
```ts
import { execSync } from 'node:child_process';

// Ensure the API's databases are migrated and seeded before the run.
export default function globalSetup() {
  execSync('pnpm --filter api exec prisma migrate deploy', { stdio: 'inherit' });
  execSync('pnpm --filter api db:seed', { stdio: 'inherit' });
}
```

- [ ] **Step 4: The purchase-flow spec**

`apps/web/e2e/purchase.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('guest adds to cart, registers, and checks out', async ({ page }) => {
  const email = `e2e_${Date.now()}@example.com`;

  // Browse and add a product to the guest cart.
  await page.goto('/products');
  await page.getByRole('link').filter({ hasText: /\$/ }).first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();

  // Register (guest cart merges into the server cart on login).
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill('secret123');
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL('/');

  // Checkout.
  await page.goto('/checkout');
  await page.getByLabel(/name/i).fill('E2E Tester');
  await page.getByLabel(/address/i).fill('1 Test Way');
  await page.getByRole('button', { name: /place order/i }).click();

  // Land on the order confirmation with a Paid status.
  await expect(page).toHaveURL(/\/account\/orders\/.+/);
  await expect(page.getByText(/thank you/i)).toBeVisible();
  await expect(page.getByText(/paid/i)).toBeVisible();
});
```

`apps/web/package.json` — add script: `"test:e2e": "playwright test"`.

- [ ] **Step 5: Run the E2E**

Run: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter web exec playwright test"`
Expected: 1 passed. If a selector is brittle, adjust to match the rendered "Measured" markup (report the fix). If chromium/system deps fail to install in the container, capture the error and report — the config + spec still land for CI.

- [ ] **Step 6: Commit** — `git add apps/web/playwright.config.ts apps/web/e2e apps/web/vitest.config.ts apps/web/package.json pnpm-lock.yaml && git commit -m "test(web): Playwright purchase-flow e2e"`

---

### Task 7: CI Playwright job

**Files:** Modify `.github/workflows/ci.yml`.

- [ ] **Step 1: Add an e2e job** after `verify`:
```yaml
  e2e:
    runs-on: ubuntu-latest
    needs: verify
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_USER: shop, POSTGRES_PASSWORD: shop, POSTGRES_DB: shop }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U shop"
          --health-interval 5s --health-timeout 5s --health-retries 10
      mongo:
        image: mongo:7
        ports: ["27017:27017"]
        options: >-
          --health-cmd "mongosh --quiet --eval \"db.adminCommand('ping')\""
          --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://shop:shop@localhost:5432/shop
      MONGO_URL: mongodb://localhost:27017/shop
      JWT_ACCESS_SECRET: ci_access_secret_not_for_production_0123456789
      JWT_REFRESH_SECRET: ci_refresh_secret_not_for_production_0123456789
      ADMIN_EMAIL: admin@example.com
      ADMIN_PASSWORD: ci_admin_password_change_me
      NEXT_PUBLIC_API_URL: http://localhost:3000/api/v1
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api exec prisma generate
      - run: pnpm --filter web exec playwright install --with-deps chromium
      - run: pnpm --filter web run test:e2e
```

- [ ] **Step 2: Commit** — `git add .github/workflows/ci.yml && git commit -m "ci: add Playwright e2e job"`

---

### Task 8: Pipeline + verification

- [ ] **Step 1: Workspace pipeline** — `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit; e2e excluded), `NODE_ENV=production pnpm build`. All green; `pnpm install --frozen-lockfile` consistent.
- [ ] **Step 2: E2E** — `pnpm --filter web exec playwright test` green (from Task 6).
- [ ] **Step 3: Commit any fixes.**

---

## Definition of Done (M4 / Phase 2)

- An authed shopper checks out, sees the order confirmation, and browses order history; guests hitting checkout/account are redirected to login.
- Checkout surfaces out-of-stock (409) and empty-cart (400) cleanly; success routes to the order.
- A Playwright test drives catalog → cart → register → checkout → PAID order and passes.
- `lint`, `typecheck`, unit `test`, `build` green across the workspace; CI runs unit + e2e.
- Phase 2 (web storefront) is complete.
