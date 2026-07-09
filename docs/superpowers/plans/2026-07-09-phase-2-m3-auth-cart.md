# Phase 2 · M3 — Auth + Cart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a shopper register/log in and keep a cart — guest cart lives client-side and merges into the server cart on login; authed cart is server-backed. Reuses the "Measured" identity from M2.

**Architecture:** Access JWT held in memory (module holder + React context); refresh token in the httpOnly cookie the API already sets. A client wrapper injects the current access token into `@repo/api-client` calls and, on a 401, refreshes once and retries (spec §8). Guest cart is a zustand store persisted to localStorage that snapshots product display data; on login every guest line is POSTed to `/cart/items` (server increments qty) and the local cart is cleared (spec §9). Authed cart reads/writes the server cart through TanStack Query.

**Tech Stack:** Next.js 15 (App Router) · `@repo/api-client` · `@repo/types` · zustand + zustand/middleware persist · @tanstack/react-query · react-hook-form + @hookform/resolvers/zod · Vitest + @testing-library/react.

## Global Constraints

- Reuse the **Measured** tokens/components from M2 (paper/ink/graphite/hairline + cobalt accent; Space Grotesk/Inter/IBM Plex Mono; `Price`, `Button`, `.ruler`). No new visual direction.
- Auth: **access token in memory only** (never localStorage); refresh via the httpOnly cookie (`credentials: 'include'`, already the api-client default). Silent refresh on app mount; on any 401 refresh once then retry, else drop to guest.
- Contracts from `@repo/types` only: `registerInput`, `loginInput` for forms; `addCartItemInput` for cart writes. Never redefine them.
- Guest cart persists to `localStorage` under key `guest-cart`; each line snapshots `{ productId, slug, title, priceCents, currency, image?, qty }` so the cart renders without refetching. Server re-validates price/stock at checkout (Phase 1), so a stale snapshot is display-only.
- New client components need `'use client'`. Cart/account pages are client-rendered.
- Commands run in `fullstack-dev-1`. Local production build uses `NODE_ENV=production pnpm --filter web build` (dev container forces `NODE_ENV=development`). `lint`/`typecheck`/`test` run without it. Conventional Commits; no push/PR until asked.
- New dep: `react-hook-form`, `@hookform/resolvers`, `zustand` in `apps/web` (install in the container).

---

## File Structure

```
apps/web/
├─ lib/
│  ├─ auth-client.ts          # NEW → token holder + `authed()` (401→refresh→retry)  (+test)
│  ├─ guest-cart.ts           # NEW → zustand store (persist) + merge helper           (+test)
│  └─ cart.ts                 # NEW → server-cart query/mutation hooks + useAddToCart
├─ app/
│  ├─ _components/
│  │  ├─ auth-provider.tsx     # NEW (client) → AuthContext + useAuth
│  │  ├─ auth-form.tsx         # NEW (client) → shared login/register form (rhf+zod)
│  │  ├─ add-to-cart.tsx       # NEW (client) → button on product detail
│  │  ├─ cart-badge.tsx        # NEW (client) → header item count
│  │  └─ cart-view.tsx         # NEW (client) → cart lines + qty/remove
│  ├─ providers.tsx           # UPDATE → mount AuthProvider inside QueryClientProvider
│  ├─ login/page.tsx          # NEW
│  ├─ register/page.tsx       # NEW
│  ├─ cart/page.tsx           # NEW
│  ├─ _components/site-header.tsx  # UPDATE → cart badge + account/login link
│  └─ products/[slug]/page.tsx     # UPDATE → mount <AddToCart product=… />
```

Order: auth-client (T1) → guest-cart (T2) → auth-provider (T3) → cart data layer (T4) → auth pages (T5) → cart page + add-to-cart + header (T6) → merge + logout wiring (T7) → pipeline + live e2e (T8).

---

### Task 1: Auth token holder + `authed()` wrapper (TDD)

**Files:** Create `apps/web/lib/auth-client.ts`, `apps/web/lib/auth-client.test.ts`

**Interfaces:**
- Produces: `getAccessToken(): string | null`; `setAccessToken(t: string | null): void`; `authed<T>(call: (opts: { accessToken?: string }) => Promise<T>): Promise<T>` — runs `call` with the current token; on `ApiError` 401, calls api-client `refresh()`, stores the new token, retries `call` once; if refresh fails, clears the token and rethrows.

- [ ] **Step 1: Failing test**

`apps/web/lib/auth-client.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('@repo/api-client', async (orig) => {
  const actual = await orig<typeof import('@repo/api-client')>();
  return { ...actual, refresh };
});

import { ApiError } from '@repo/api-client';
import { authed, getAccessToken, setAccessToken } from './auth-client';

afterEach(() => {
  refresh.mockReset();
  setAccessToken(null);
});

describe('authed', () => {
  it('passes the current token and returns the result', async () => {
    setAccessToken('tok');
    const call = vi.fn(async (o: { accessToken?: string }) => o.accessToken);
    await expect(authed(call)).resolves.toBe('tok');
  });

  it('refreshes once and retries on 401', async () => {
    setAccessToken('stale');
    refresh.mockResolvedValueOnce({ accessToken: 'fresh', refreshToken: 'r' });
    const call = vi
      .fn<[{ accessToken?: string }], Promise<string>>()
      .mockRejectedValueOnce(new ApiError(401, 'expired'))
      .mockResolvedValueOnce('ok');
    await expect(authed(call)).resolves.toBe('ok');
    expect(refresh).toHaveBeenCalledOnce();
    expect(getAccessToken()).toBe('fresh');
    expect(call).toHaveBeenLastCalledWith({ accessToken: 'fresh' });
  });

  it('clears the token and rethrows when refresh fails', async () => {
    setAccessToken('stale');
    refresh.mockRejectedValueOnce(new ApiError(401, 'no session'));
    const call = vi.fn().mockRejectedValue(new ApiError(401, 'expired'));
    await expect(authed(call)).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter web test` FAIL (module missing).

- [ ] **Step 3: Implement**

`apps/web/lib/auth-client.ts`:
```ts
import { ApiError, refresh } from '@repo/api-client';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// Run an api-client call with the current access token. On a 401, refresh once
// (cookie-based) and retry; if the refresh itself fails, drop the session.
export async function authed<T>(
  call: (opts: { accessToken?: string }) => Promise<T>,
): Promise<T> {
  try {
    return await call({ accessToken: accessToken ?? undefined });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    try {
      const tokens = await refresh();
      accessToken = tokens.accessToken;
    } catch (refreshError) {
      accessToken = null;
      throw refreshError;
    }
    return call({ accessToken: accessToken ?? undefined });
  }
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter web test` green.

- [ ] **Step 5: Commit** — `git add apps/web/lib/auth-client.ts apps/web/lib/auth-client.test.ts && git commit -m "feat(web): in-memory access token with 401 refresh-and-retry"`

---

### Task 2: Guest cart store (zustand, TDD)

**Files:** Create `apps/web/lib/guest-cart.ts`, `apps/web/lib/guest-cart.test.ts`. Install `zustand`.

**Interfaces:**
- `GuestCartItem = { productId: string; slug: string; title: string; priceCents: number; currency: string; image?: string; qty: number }`.
- `useGuestCart` (zustand store) with state `items` and actions `add(item: Omit<GuestCartItem,'qty'>, qty?)`, `setQty(productId, qty)` (qty<=0 removes), `remove(productId)`, `clear()`. Usable outside React via `useGuestCart.getState()`.

- [ ] **Step 1: Install zustand**

Run: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter web add zustand"`

- [ ] **Step 2: Failing test**

`apps/web/lib/guest-cart.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useGuestCart } from './guest-cart';

const base = { productId: 'p1', slug: 'p-1', title: 'P1', priceCents: 1000, currency: 'USD' };

beforeEach(() => useGuestCart.getState().clear());

describe('guest cart', () => {
  it('adds a new line with default qty 1', () => {
    useGuestCart.getState().add(base);
    expect(useGuestCart.getState().items).toEqual([{ ...base, qty: 1 }]);
  });
  it('accumulates qty when adding the same product', () => {
    useGuestCart.getState().add(base, 2);
    useGuestCart.getState().add(base, 3);
    expect(useGuestCart.getState().items[0].qty).toBe(5);
  });
  it('setQty to 0 removes the line', () => {
    useGuestCart.getState().add(base, 2);
    useGuestCart.getState().setQty('p1', 0);
    expect(useGuestCart.getState().items).toHaveLength(0);
  });
  it('remove drops the line; clear empties', () => {
    useGuestCart.getState().add(base);
    useGuestCart.getState().remove('p1');
    expect(useGuestCart.getState().items).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run, verify fail** — FAIL (module missing).

- [ ] **Step 4: Implement**

`apps/web/lib/guest-cart.ts`:
```ts
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
```

- [ ] **Step 5: Run, verify pass** — green.

- [ ] **Step 6: Commit** — `git add apps/web/lib/guest-cart.ts apps/web/lib/guest-cart.test.ts pnpm-lock.yaml && git commit -m "feat(web): guest cart store (zustand + localStorage)"`

---

### Task 3: AuthProvider + useAuth

**Files:** Create `apps/web/app/_components/auth-provider.tsx`; Modify `apps/web/app/providers.tsx`. Test: `apps/web/app/_components/auth-provider.test.tsx`.

**Interfaces:**
- `AuthProvider` (client) wraps children; on mount attempts a silent `refresh()` → on success stores token + fetches `me()`; else guest.
- `useAuth()` → `{ status: 'loading'|'authed'|'guest'; user: MeResponse | null; login(input): Promise<void>; register(input): Promise<void>; logout(): Promise<void> }`.
- `login`/`register` store the access token, set the user, then run the guest-cart merge (Task 7 wires the merge call — here call a passed-in/imported `mergeGuestCart` no-op placeholder is NOT allowed; import the real merge from `lib/cart` added in Task 4). To keep tasks ordered, Task 3 calls `mergeGuestCartIntoServer()` from `@/lib/cart`, which Task 4 creates. Implement Task 4 before running Task 3's app (tests for Task 3 mock `@/lib/cart`).

- [ ] **Step 1: Failing test**

`apps/web/app/_components/auth-provider.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = { refresh: vi.fn(), me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() };
vi.mock('@repo/api-client', async (orig) => ({ ...(await orig<object>()), ...api }));
vi.mock('@/lib/cart', () => ({ mergeGuestCartIntoServer: vi.fn().mockResolvedValue(undefined) }));

import { AuthProvider, useAuth } from './auth-provider';

function Probe() {
  const { status, user } = useAuth();
  return <span>{status}:{user?.email ?? '-'}</span>;
}

afterEach(() => Object.values(api).forEach((m) => m.mockReset()));

describe('AuthProvider', () => {
  it('restores a session via silent refresh on mount', async () => {
    api.refresh.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
    api.me.mockResolvedValueOnce({ id: 'u1', email: 'me@x.io', role: 'CUSTOMER' });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('authed:me@x.io')).toBeInTheDocument());
  });

  it('falls back to guest when there is no session', async () => {
    api.refresh.mockRejectedValueOnce(new Error('no session'));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('guest:-')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run, verify fail** — FAIL.

- [ ] **Step 3: Implement**

`apps/web/app/_components/auth-provider.tsx`:
```tsx
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  login as loginApi,
  logout as logoutApi,
  me as meApi,
  refresh as refreshApi,
  register as registerApi,
} from '@repo/api-client';
import type { LoginInput, MeResponse, RegisterInput } from '@repo/types';
import { setAccessToken } from '@/lib/auth-client';
import { mergeGuestCartIntoServer } from '@/lib/cart';

type Status = 'loading' | 'authed' | 'guest';
type AuthValue = {
  status: Status;
  user: MeResponse | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<MeResponse | null>(null);

  useEffect(() => {
    let active = true;
    refreshApi()
      .then(async (tokens) => {
        setAccessToken(tokens.accessToken);
        const profile = await meApi({ accessToken: tokens.accessToken });
        if (active) {
          setUser(profile);
          setStatus('authed');
        }
      })
      .catch(() => {
        if (active) {
          setAccessToken(null);
          setStatus('guest');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function establish(tokens: { accessToken: string }) {
    setAccessToken(tokens.accessToken);
    const profile = await meApi({ accessToken: tokens.accessToken });
    await mergeGuestCartIntoServer(tokens.accessToken);
    setUser(profile);
    setStatus('authed');
  }

  const value: AuthValue = {
    status,
    user,
    login: async (input) => establish(await loginApi(input)),
    register: async (input) => establish(await registerApi(input)),
    logout: async () => {
      await logoutApi({ accessToken: undefined }).catch(() => undefined);
      setAccessToken(null);
      setUser(null);
      setStatus('guest');
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

`apps/web/app/providers.tsx` — mount AuthProvider inside QueryClientProvider:
```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from './_components/auth-provider';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Run, verify pass** (after Task 4 exists, `@/lib/cart` resolves; the test mocks it so it passes now). Run `pnpm --filter web test`.

- [ ] **Step 5: Commit** — `git add apps/web/app/_components/auth-provider.tsx apps/web/app/_components/auth-provider.test.tsx apps/web/app/providers.tsx && git commit -m "feat(web): auth provider with silent refresh"`

> Sequencing: implement Task 4 (`lib/cart`) before running the app so the `@/lib/cart` import resolves at build. The Task 3 unit test mocks it and passes independently.

---

### Task 4: Cart data layer (server cart hooks + merge)

**Files:** Create `apps/web/lib/cart.ts`. Test: `apps/web/lib/cart.test.ts` (merge logic).

**Interfaces:**
- `mergeGuestCartIntoServer(accessToken: string): Promise<void>` — for each guest line, `addCartItem({ productId, qty }, { accessToken })`; then `useGuestCart.getState().clear()`.
- `useServerCart()` — TanStack Query for `getCart` via `authed`, enabled when authed.
- `useCartMutations()` — add/update/remove via `authed`, invalidating the cart query.

- [ ] **Step 1: Failing test (merge)**

`apps/web/lib/cart.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const addCartItem = vi.fn().mockResolvedValue({ id: 'c', items: [] });
vi.mock('@repo/api-client', async (orig) => ({ ...(await orig<object>()), addCartItem }));

import { useGuestCart } from './guest-cart';
import { mergeGuestCartIntoServer } from './cart';

afterEach(() => {
  addCartItem.mockClear();
  useGuestCart.getState().clear();
});

describe('mergeGuestCartIntoServer', () => {
  it('posts each guest line then clears the local cart', async () => {
    useGuestCart.getState().add({ productId: 'p1', slug: 'p-1', title: 'P1', priceCents: 100, currency: 'USD' }, 2);
    useGuestCart.getState().add({ productId: 'p2', slug: 'p-2', title: 'P2', priceCents: 200, currency: 'USD' }, 1);

    await mergeGuestCartIntoServer('tok');

    expect(addCartItem).toHaveBeenCalledTimes(2);
    expect(addCartItem).toHaveBeenCalledWith({ productId: 'p1', qty: 2 }, { accessToken: 'tok' });
    expect(useGuestCart.getState().items).toHaveLength(0);
  });

  it('does nothing when the guest cart is empty', async () => {
    await mergeGuestCartIntoServer('tok');
    expect(addCartItem).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verify fail** — FAIL.

- [ ] **Step 3: Implement**

`apps/web/lib/cart.ts`:
```ts
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
      mutationFn: (v: { productId: string; qty: number }) =>
        authed((opts) => addCartItem(v, opts)),
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
```

- [ ] **Step 4: Run, verify pass** — green.

- [ ] **Step 5: Commit** — `git add apps/web/lib/cart.ts apps/web/lib/cart.test.ts && git commit -m "feat(web): server cart hooks and guest-cart merge"`

---

### Task 5: Auth pages (login + register)

**Files:** Create `apps/web/app/_components/auth-form.tsx`, `apps/web/app/login/page.tsx`, `apps/web/app/register/page.tsx`. Install `react-hook-form`, `@hookform/resolvers`. Test: `apps/web/app/_components/auth-form.test.tsx`.

**Interfaces:**
- `AuthForm({ mode })` (client) where `mode: 'login'|'register'` — email+password fields (rhf + zod resolver over `loginInput`/`registerInput`), submits via `useAuth().login`/`register`, shows a form-level error on `ApiError`, redirects to `/` on success (`useRouter().push`).

- [ ] **Step 1: Install form deps** — `pnpm --filter web add react-hook-form @hookform/resolvers`

- [ ] **Step 2: Failing test**

`apps/web/app/_components/auth-form.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const login = vi.fn();
vi.mock('./auth-provider', () => ({ useAuth: () => ({ login, register: vi.fn(), status: 'guest' }) }));

import { AuthForm } from './auth-form';

describe('AuthForm', () => {
  it('renders email + password fields and a submit button for login', () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run, verify fail** — FAIL.

- [ ] **Step 4: Implement**

`apps/web/app/_components/auth-form.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { loginInput, registerInput, type LoginInput } from '@repo/types';
import { ApiError } from '@repo/api-client';
import { Button } from '@repo/ui';
import { useAuth } from './auth-provider';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(mode === 'login' ? loginInput : registerInput) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (mode === 'login') await auth.login(values);
      else await auth.register(values);
      router.push('/');
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Something went wrong');
    }
  });

  const label = mode === 'login' ? 'Log in' : 'Create account';
  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4">
      <h1 className="font-display text-2xl font-semibold text-ink">{label}</h1>
      <label className="block text-sm">
        <span className="text-graphite">Email</span>
        <input
          type="email"
          {...register('email')}
          className="mt-1 w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-ink"
        />
        {errors.email && <span className="text-sm text-accent">{errors.email.message}</span>}
      </label>
      <label className="block text-sm">
        <span className="text-graphite">Password</span>
        <input
          type="password"
          {...register('password')}
          className="mt-1 w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-ink"
        />
        {errors.password && <span className="text-sm text-accent">{errors.password.message}</span>}
      </label>
      {formError && <p className="text-sm text-accent">{formError}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {label}
      </Button>
    </form>
  );
}
```

`apps/web/app/login/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { AuthForm } from '@/app/_components/auth-form';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <main className="px-4 py-16">
      <AuthForm mode="login" />
      <p className="mx-auto mt-4 max-w-sm text-sm text-graphite">
        No account?{' '}
        <a href="/register" className="text-accent hover:underline">
          Create one
        </a>
      </p>
    </main>
  );
}
```

`apps/web/app/register/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { AuthForm } from '@/app/_components/auth-form';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <main className="px-4 py-16">
      <AuthForm mode="register" />
      <p className="mx-auto mt-4 max-w-sm text-sm text-graphite">
        Have an account?{' '}
        <a href="/login" className="text-accent hover:underline">
          Log in
        </a>
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Run, verify pass + gates** — `pnpm --filter web test`; `typecheck`; `lint`.

- [ ] **Step 6: Commit** — `git add apps/web/app/_components/auth-form.tsx apps/web/app/_components/auth-form.test.tsx apps/web/app/login apps/web/app/register pnpm-lock.yaml && git commit -m "feat(web): login and register pages"`

---

### Task 6: Cart page + add-to-cart + header cart badge

**Files:** Create `apps/web/app/_components/add-to-cart.tsx`, `apps/web/app/_components/cart-badge.tsx`, `apps/web/app/_components/cart-view.tsx`, `apps/web/app/cart/page.tsx`. Modify `apps/web/app/products/[slug]/page.tsx`, `apps/web/app/_components/site-header.tsx`. Test: `apps/web/app/_components/add-to-cart.test.tsx`.

**Interfaces:**
- `AddToCart({ product })` (client) — a Button; guest → `useGuestCart.add(snapshot)`, authed → `useCartMutations().add`. Snapshot = `{ productId, slug, title, priceCents, currency, image }`.
- `CartBadge()` (client) — shows total item count (guest store count when guest; server cart count when authed).
- `CartView()` (client) — renders lines with `Price`, qty stepper, remove; guest vs server source by auth status; empty state.

- [ ] **Step 1: Failing test (AddToCart, guest path)**

`apps/web/app/_components/add-to-cart.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth-provider', () => ({ useAuth: () => ({ status: 'guest' }) }));
vi.mock('@/lib/cart', () => ({ useCartMutations: () => ({ add: { mutate: vi.fn() } }) }));

import { useGuestCart } from '@/lib/guest-cart';
import { AddToCart } from './add-to-cart';

const product = {
  id: 'p1',
  slug: 'usb-c-cable',
  title: 'USB-C Cable',
  priceCents: 1900,
  currency: 'USD',
  images: [],
} as never;

afterEach(() => useGuestCart.getState().clear());

describe('AddToCart (guest)', () => {
  it('adds a snapshot line to the guest cart', () => {
    render(<AddToCart product={product} />);
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));
    const items = useGuestCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productId: 'p1', qty: 1, title: 'USB-C Cable' });
  });
});
```

- [ ] **Step 2: Run, verify fail** — FAIL.

- [ ] **Step 3: Implement components**

`apps/web/app/_components/add-to-cart.tsx`:
```tsx
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
```

`apps/web/app/_components/cart-badge.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { useAuth } from './auth-provider';
import { useGuestCart } from '@/lib/guest-cart';
import { useServerCart } from '@/lib/cart';

export function CartBadge() {
  const { status } = useAuth();
  const guestCount = useGuestCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const server = useServerCart(status === 'authed');
  const count =
    status === 'authed'
      ? (server.data?.items.reduce((n, i) => n + i.qty, 0) ?? 0)
      : guestCount;
  return (
    <Link href="/cart" className="font-mono text-sm text-ink hover:text-accent">
      Cart [{count}]
    </Link>
  );
}
```

`apps/web/app/_components/cart-view.tsx`:
```tsx
'use client';

import { Price } from '@repo/ui';
import { useAuth } from './auth-provider';
import { useGuestCart } from '@/lib/guest-cart';
import { useServerCart, useCartMutations } from '@/lib/cart';

type Line = { productId: string; title: string; priceCents: number; currency: string; qty: number };

export function CartView() {
  const { status } = useAuth();
  const guest = useGuestCart();
  const server = useServerCart(status === 'authed');
  const mut = useCartMutations();

  const lines: Line[] =
    status === 'authed'
      ? (server.data?.items ?? []).map((i) => {
          const p = i.product as { title: string; priceCents: number; currency: string };
          return { productId: i.productId, title: p.title, priceCents: p.priceCents, currency: p.currency, qty: i.qty };
        })
      : guest.items.map((i) => ({
          productId: i.productId,
          title: i.title,
          priceCents: i.priceCents,
          currency: i.currency,
          qty: i.qty,
        }));

  if (lines.length === 0) return <p className="text-graphite">Your cart is empty.</p>;

  const setQty = (productId: string, qty: number) =>
    status === 'authed' ? mut.setQty.mutate({ productId, qty }) : guest.setQty(productId, qty);
  const remove = (productId: string) =>
    status === 'authed' ? mut.remove.mutate(productId) : guest.remove(productId);

  const total = lines.reduce((n, l) => n + l.priceCents * l.qty, 0);
  const currency = lines[0]?.currency ?? 'USD';

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-hairline border-y border-hairline">
        {lines.map((l) => (
          <li key={l.productId} className="flex items-center justify-between gap-4 py-4">
            <span className="font-display text-ink">{l.title}</span>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={1}
                value={l.qty}
                onChange={(e) => setQty(l.productId, Number(e.target.value))}
                className="w-16 rounded-sm border border-hairline bg-surface px-2 py-1 font-mono text-sm"
                aria-label={`Quantity for ${l.title}`}
              />
              <Price cents={l.priceCents * l.qty} currency={l.currency} />
              <button onClick={() => remove(l.productId)} className="text-sm text-graphite hover:text-accent">
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-hairline pt-4">
        <span className="font-mono text-sm uppercase tracking-widest text-graphite">Total</span>
        <Price cents={total} currency={currency} className="text-lg" />
      </div>
    </div>
  );
}
```

`apps/web/app/cart/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { CartView } from '@/app/_components/cart-view';

export const metadata: Metadata = { title: 'Cart' };

export default function CartPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Your cart</h1>
      <div className="mt-6">
        <CartView />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Wire into product detail + header**

In `apps/web/app/products/[slug]/page.tsx`, import `AddToCart` and render it under the Price:
```tsx
import { AddToCart } from '@/app/_components/add-to-cart';
// …after the <Price …/> line:
          <div className="mt-6">
            <AddToCart product={product} />
          </div>
```

In `apps/web/app/_components/site-header.tsx`, add `CartBadge` and an account/login link to the nav (after the Catalog link):
```tsx
import { CartBadge } from './cart-badge';
// …inside <nav>, after the Catalog <Link>:
          <Link href="/login" className="text-graphite hover:text-accent">
            Account
          </Link>
          <CartBadge />
```

- [ ] **Step 5: Run tests + gates** — `pnpm --filter web test`; `typecheck`; `lint`; `NODE_ENV=production pnpm --filter web build` (routes `/login`, `/register`, `/cart` present).

- [ ] **Step 6: Commit** — `git add apps/web/app && git commit -m "feat(web): cart page, add-to-cart, and header cart badge"`

---

### Task 7: Merge + logout end-to-end wiring

Most wiring landed in Tasks 3–6 (login calls `mergeGuestCartIntoServer`; logout clears token/user). This task verifies the whole flow and fills gaps.

**Files:** Modify `apps/web/app/_components/site-header.tsx` (show account email + logout when authed). Test: extend `auth-provider.test.tsx` or add `site-header` behavior via a small client `account-nav` component if the header must stay a server component.

> Note: `SiteHeader` is a server component; auth state is client-side. Extract the account/cart area into a client `HeaderAccount` component and render it inside the server header.

- [ ] **Step 1: Create `HeaderAccount` (client)**

`apps/web/app/_components/header-account.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { useAuth } from './auth-provider';
import { CartBadge } from './cart-badge';

export function HeaderAccount() {
  const { status, user, logout } = useAuth();
  return (
    <div className="flex items-center gap-4 text-sm">
      {status === 'authed' && user ? (
        <>
          <span className="font-mono text-xs text-graphite">{user.email}</span>
          <button onClick={() => logout()} className="text-graphite hover:text-accent">
            Log out
          </button>
        </>
      ) : (
        <Link href="/login" className="text-graphite hover:text-accent">
          Account
        </Link>
      )}
      <CartBadge />
    </div>
  );
}
```

- [ ] **Step 2: Use it in the header**

In `apps/web/app/_components/site-header.tsx`, replace the inline Account link + CartBadge (from Task 6 Step 4) with `<HeaderAccount />` after the Catalog link, and import it. Keep category links + Catalog as server-rendered.

- [ ] **Step 3: Gates** — `typecheck`; `lint`; `NODE_ENV=production pnpm --filter web build`.

- [ ] **Step 4: Commit** — `git add apps/web/app/_components && git commit -m "feat(web): header account controls and logout"`

---

### Task 8: Pipeline + live e2e verification

- [ ] **Step 1: Workspace pipeline** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `NODE_ENV=production pnpm build`. All green.

- [ ] **Step 2: Live flow (seeded API + web)** — start API + web; verify by API-backed checks (the M2 pattern): register a fresh user via the UI/endpoint, confirm `/auth/me` works with the issued token; add a product to the guest cart, log in, confirm the item appears in `GET /cart`. Confirm `/login`, `/register`, `/cart` return 200. Drive with the `run`/`verify` skill; screenshots are optional (Playwright deferred to M4).

- [ ] **Step 3: Commit any fixes.**

---

## Definition of Done (M3)

- A guest can browse, add to a client-side cart (persisted), then register/log in and see those items merged into the server cart.
- Auth uses an in-memory access token with silent refresh on load and 401 refresh-and-retry; logout clears state.
- `/login`, `/register`, `/cart` work; header shows cart count and account/logout.
- `lint`, `typecheck`, `test` green across the workspace; `NODE_ENV=production pnpm build` green.
- No contract shapes redefined outside `@repo/types`; checkout UI + Playwright E2E remain for M4.
