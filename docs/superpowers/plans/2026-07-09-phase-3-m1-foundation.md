# Phase 3 · M1 — Admin Foundation + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/admin` — a Next.js App Router admin app on port 3002, behind an ADMIN-only auth guard, with a dense "Measured" shell and the admin api-client surface — so later milestones add catalog CRUD, orders, users, and a dashboard.

**Architecture:** Client-heavy (the whole tool is auth-gated; server components can't reach the in-memory access token). Access JWT in memory + refresh cookie (same pattern as Phase 2 M3). `AuthProvider` does silent refresh and only treats a user as authed when `role === 'ADMIN'`; `RequireAdmin` gates every page inside an `AdminShell` (sidebar + topbar). Reuses `@repo/ui` (Measured tokens), `@repo/api-client` (extended with admin functions), `@repo/types`. Consumed as source via `transpilePackages`, mirroring `apps/web`.

**Tech Stack:** Next.js 15 · React 19 · `@repo/api-client`/`@repo/ui`/`@repo/types` · TanStack Query 5 · react-hook-form + zod · Tailwind 3.4 + next/font · Vitest + @testing-library/react.

## Global Constraints

- **Measured** design system from `@repo/ui` (paper/ink/graphite/hairline + cobalt accent; Space Grotesk/Inter/IBM Plex Mono). Admin uses a **dense** layout (compact tables, tight forms, small radii) but the same tokens/fonts.
- `apps/admin` listens on **3002**; dev docker-compose already allows `CORS_ORIGINS=…,http://localhost:3002`. API base URL from `NEXT_PUBLIC_API_URL` (default `http://localhost:3000/api/v1`).
- Auth: **access token in memory only**; refresh via httpOnly cookie (`credentials:'include'`). A user is "authed" for the admin app only when `role === 'ADMIN'`; a logged-in CUSTOMER is treated as not-authorized.
- Contracts from `@repo/types` only. `@repo/api-client` and `@repo/ui` consumed as source; `next.config.mjs` lists both + `@repo/types` in `transpilePackages`; `eslint: { ignoreDuringBuilds: true }`.
- Mirror `apps/web` conventions exactly: `eslint.config.mjs` = `export { default } from '@repo/config/eslint';` (no direct eslint dep); `next-env.d.ts` committed (2-line) + eslint-ignored; `vitest.config.ts` sets `esbuild: { jsx: 'automatic' }` + `resolve.alias '@'` + `exclude: ['e2e/**', …]`; test mocks use `vi.hoisted` and `vi.fn<(a)=>r>()`.
- Commands run in `fullstack-dev-1`. Local production build uses `NODE_ENV=production pnpm --filter admin build` (dev container forces `NODE_ENV=development`); `lint`/`typecheck`/`test` run without it. Conventional Commits; no push/PR until asked.
- New deps in `apps/admin`: `next`, `react`, `react-dom`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, and dev: types, tailwind/postcss/autoprefixer, vitest + testing-library + jsdom.

---

## File Structure

```
packages/api-client/src/
├─ admin.ts                    # NEW → catalog mutations + admin orders (typed)          (+test)
├─ admin.test.ts
└─ index.ts                    # UPDATE → export ./admin
apps/admin/
├─ package.json  next.config.mjs  tsconfig.json  next-env.d.ts
├─ tailwind.config.ts  postcss.config.mjs  eslint.config.mjs
├─ vitest.config.ts  vitest.setup.ts  .env.example
├─ lib/
│  └─ auth-client.ts           # NEW → token holder + authed() (copy of web's)
└─ app/
   ├─ globals.css  layout.tsx  providers.tsx  page.tsx
   └─ _components/
      ├─ auth-provider.tsx      # NEW (client) → admin AuthProvider (role-aware)          (+test)
      ├─ require-admin.tsx      # NEW (client) → gate: ADMIN → children, else /login      (+test)
      └─ admin-shell.tsx        # NEW (client) → sidebar + topbar around children
```

Order: api-client admin functions (T1) → app scaffold (T2) → auth-client + AuthProvider (T3) → RequireAdmin (T4) → AdminShell + login + layout (T5) → pipeline (T6).

---

### Task 1: `@repo/api-client` admin functions

**Files:** Create `packages/api-client/src/admin.ts`, `packages/api-client/src/admin.test.ts`; Modify `packages/api-client/src/index.ts`.

**Interfaces (Produces):**
- `createProduct(input: CreateProductInput, opts?)`, `updateProduct(id, input: UpdateProductInput, opts?)`, `deleteProduct(id, opts?)`
- `createCategory(input: CreateCategoryInput, opts?)`, `updateCategory(id, input: UpdateCategoryInput, opts?)`, `deleteCategory(id, opts?)`
- `listAllOrders(query: Partial<PageQuery>, opts?): Promise<OrderList>`, `updateOrderStatus(id, status: OrderStatusValue, opts?): Promise<Order>`

- [ ] **Step 1: Failing test**

`packages/api-client/src/admin.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProduct, listAllOrders, updateOrderStatus } from './index';

afterEach(() => vi.unstubAllGlobals());

function capture(status: number, body: unknown) {
  const spy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

describe('admin api-client', () => {
  it('POSTs a product with the access token', async () => {
    const spy = capture(201, { id: 'p1' });
    await createProduct(
      { title: 'X', slug: 'x', description: 'd', priceCents: 100, categoryId: 'c1' } as never,
      { baseUrl: 'http://api', accessToken: 'tok' },
    );
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api/products');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok');
  });

  it('builds the admin orders query and PATCHes status', async () => {
    const spy = capture(200, { items: [], total: 0, page: 2, limit: 20 });
    await listAllOrders({ page: 2 }, { baseUrl: 'http://api' });
    expect(spy.mock.calls[0][0]).toBe('http://api/admin/orders?page=2');

    const spy2 = capture(200, { id: 'o1', status: 'SHIPPED' });
    await updateOrderStatus('o1', 'SHIPPED', { baseUrl: 'http://api' });
    const [url, init] = spy2.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api/admin/orders/o1/status');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'SHIPPED' });
  });
});
```

- [ ] **Step 2: Run, verify fail** — `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter @repo/api-client test"` → FAIL (exports missing).

- [ ] **Step 3: Implement**

`packages/api-client/src/admin.ts`:
```ts
import type {
  CreateCategoryInput,
  CreateProductInput,
  OrderStatusValue,
  PageQuery,
  Product,
  UpdateCategoryInput,
  UpdateProductInput,
} from '@repo/types';
import { apiFetch, toQuery, type RequestOptions } from './http';
import type { Order, OrderList } from './orders';

const json = (method: string, body: unknown, opts?: RequestOptions): RequestOptions => ({
  ...opts,
  init: { ...opts?.init, method, body: JSON.stringify(body) },
});

export function createProduct(input: CreateProductInput, opts?: RequestOptions): Promise<Product> {
  return apiFetch<Product>('/products', json('POST', input, opts));
}
export function updateProduct(id: string, input: UpdateProductInput, opts?: RequestOptions): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`, json('PATCH', input, opts));
}
export function deleteProduct(id: string, opts?: RequestOptions): Promise<unknown> {
  return apiFetch<unknown>(`/products/${id}`, { ...opts, init: { ...opts?.init, method: 'DELETE' } });
}
export function createCategory(input: CreateCategoryInput, opts?: RequestOptions) {
  return apiFetch('/categories', json('POST', input, opts));
}
export function updateCategory(id: string, input: UpdateCategoryInput, opts?: RequestOptions) {
  return apiFetch(`/categories/${id}`, json('PATCH', input, opts));
}
export function deleteCategory(id: string, opts?: RequestOptions) {
  return apiFetch(`/categories/${id}`, { ...opts, init: { ...opts?.init, method: 'DELETE' } });
}
export function listAllOrders(query: Partial<PageQuery> = {}, opts?: RequestOptions): Promise<OrderList> {
  return apiFetch<OrderList>(`/admin/orders${toQuery(query)}`, opts);
}
export function updateOrderStatus(id: string, status: OrderStatusValue, opts?: RequestOptions): Promise<Order> {
  return apiFetch<Order>(`/admin/orders/${id}/status`, json('PATCH', { status }, opts));
}
```

`packages/api-client/src/index.ts` — append: `export * from './admin';`

- [ ] **Step 4: Run, verify pass + typecheck** — `pnpm --filter @repo/api-client test` green; `pnpm --filter @repo/api-client typecheck` clean (build `@repo/types` first if stale: `pnpm --filter @repo/types build`).

- [ ] **Step 5: Commit** — `git add packages/api-client && git commit -m "feat(api-client): admin catalog and order-status functions"`

---

### Task 2: `apps/admin` Next.js scaffold

**Files:** Create `apps/admin/{package.json,next.config.mjs,tsconfig.json,next-env.d.ts,tailwind.config.ts,postcss.config.mjs,eslint.config.mjs,.env.example}` and `apps/admin/app/{globals.css,layout.tsx,page.tsx}`. Install deps.

**Interfaces:** a buildable admin app on 3002 (placeholder home).

- [ ] **Step 1: package.json**

`apps/admin/package.json` (mirrors `apps/web`, name `admin`, port `3002`; includes form + query deps used from M1 onward):
```json
{
  "name": "admin",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start -p 3002",
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@repo/api-client": "workspace:*",
    "@repo/types": "workspace:*",
    "@repo/ui": "workspace:*",
    "@hookform/resolvers": "^5.4.0",
    "@tanstack/react-query": "^5.59.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.81.0"
  },
  "devDependencies": {
    "@repo/config": "workspace:*",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.0",
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: config files** (identical to `apps/web` except where noted)

`apps/admin/next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/ui', '@repo/api-client', '@repo/types'],
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
```

`apps/admin/tsconfig.json` — copy `apps/web/tsconfig.json` verbatim (extends base, jsx preserve, bundler resolution, `@/*` paths, next plugin).

`apps/admin/next-env.d.ts`:
```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
```

`apps/admin/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';
import preset from '@repo/ui/tailwind-preset';

export default {
  presets: [preset],
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
} satisfies Config;
```

`apps/admin/postcss.config.mjs`: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };`

`apps/admin/eslint.config.mjs`:
```js
import base from '@repo/config/eslint';
export default [...base, { ignores: ['next-env.d.ts', '.next/**'] }];
```

`apps/admin/vitest.config.ts`:
```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
  },
});
```

`apps/admin/vitest.setup.ts`: `import '@testing-library/jest-dom/vitest';`

`apps/admin/.env.example`: `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1`

- [ ] **Step 3: app shell placeholder**

`apps/admin/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :focus-visible {
    outline: 2px solid theme('colors.accent.DEFAULT');
    outline-offset: 2px;
  }
}
```

`apps/admin/app/layout.tsx` (fonts + Providers; AdminShell added in Task 5):
```tsx
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Space_Grotesk, Inter, IBM_Plex_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = { title: 'Measured Admin' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-paper font-body text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

`apps/admin/app/providers.tsx` (QueryClient only for now; AuthProvider wired in Task 3):
```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

`apps/admin/app/page.tsx`: `export default function Home() { return <main className="p-8 font-display text-2xl text-ink">Admin</main>; }`

- [ ] **Step 4: Install + verify** — `pnpm install`; then `pnpm --filter admin typecheck`, `pnpm --filter admin lint`, `NODE_ENV=production pnpm --filter admin build` (route `/` listed). Reset `next-env.d.ts` to the 2-line version before committing (build rewrites it).

- [ ] **Step 5: Commit** — `git add apps/admin pnpm-lock.yaml && git commit -m "feat(admin): Next.js App Router skeleton (port 3002)"`

---

### Task 3: auth-client + admin AuthProvider

**Files:** Create `apps/admin/lib/auth-client.ts`, `apps/admin/app/_components/auth-provider.tsx`; Modify `apps/admin/app/providers.tsx`. Test: `apps/admin/app/_components/auth-provider.test.tsx`.

**Interfaces:**
- `lib/auth-client.ts` — copy of `apps/web/lib/auth-client.ts` verbatim (`getAccessToken`/`setAccessToken`/`authed`).
- `useAuth()` → `{ status: 'loading'|'authed'|'guest'; user: MeResponse | null; login; logout }`. **`login` treats a non-ADMIN as a failure**: after tokens+me, if `role !== 'ADMIN'` it clears the token and throws so the form shows "admin access only". Silent refresh on mount likewise only sets `authed` when role is ADMIN.

- [ ] **Step 1: Copy auth-client** — create `apps/admin/lib/auth-client.ts` identical to `apps/web/lib/auth-client.ts`.

- [ ] **Step 2: Failing test**

`apps/admin/app/_components/auth-provider.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ refresh: vi.fn(), me: vi.fn(), login: vi.fn(), logout: vi.fn() }));
vi.mock('@repo/api-client', async (orig) => ({ ...(await orig<object>()), ...api }));

import { AuthProvider, useAuth } from './auth-provider';

function Probe() {
  const { status, user } = useAuth();
  return <span>{status}:{user?.role ?? '-'}</span>;
}

afterEach(() => Object.values(api).forEach((m) => m.mockReset()));

describe('admin AuthProvider', () => {
  it('authes an ADMIN session on silent refresh', async () => {
    api.refresh.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
    api.me.mockResolvedValueOnce({ id: 'u1', email: 'a@x.io', role: 'ADMIN' });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('authed:ADMIN')).toBeInTheDocument());
  });

  it('treats a CUSTOMER session as guest', async () => {
    api.refresh.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
    api.me.mockResolvedValueOnce({ id: 'u2', email: 'c@x.io', role: 'CUSTOMER' });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('guest:-')).toBeInTheDocument());
  });
});
```

- [ ] **Step 3: Run, verify fail** — `pnpm --filter admin test` FAIL.

- [ ] **Step 4: Implement `auth-provider.tsx`**

`apps/admin/app/_components/auth-provider.tsx`:
```tsx
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { login as loginApi, logout as logoutApi, me as meApi, refresh as refreshApi } from '@repo/api-client';
import type { LoginInput, MeResponse } from '@repo/types';
import { setAccessToken } from '@/lib/auth-client';

type Status = 'loading' | 'authed' | 'guest';
type AuthValue = {
  status: Status;
  user: MeResponse | null;
  login: (input: LoginInput) => Promise<void>;
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
        if (!active) return;
        if (profile.role === 'ADMIN') {
          setUser(profile);
          setStatus('authed');
        } else {
          setAccessToken(null);
          setStatus('guest');
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

  const value: AuthValue = {
    status,
    user,
    login: async (input) => {
      const tokens = await loginApi(input);
      setAccessToken(tokens.accessToken);
      const profile = await meApi({ accessToken: tokens.accessToken });
      if (profile.role !== 'ADMIN') {
        setAccessToken(null);
        throw new Error('This account does not have admin access.');
      }
      setUser(profile);
      setStatus('authed');
    },
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

Wire into `apps/admin/app/providers.tsx` (wrap children in `<AuthProvider>` inside `QueryClientProvider`, importing from `./_components/auth-provider`).

- [ ] **Step 5: Run, verify pass** — `pnpm --filter admin test` green.

- [ ] **Step 6: Commit** — `git add apps/admin && git commit -m "feat(admin): admin-only auth provider with silent refresh"`

---

### Task 4: RequireAdmin guard (TDD)

**Files:** Create `apps/admin/app/_components/require-admin.tsx`, `apps/admin/app/_components/require-admin.test.tsx`.

**Interfaces:** `RequireAdmin({ children })` — `authed` → children; `loading` → null; `guest` → `useRouter().replace('/login')` + null.

- [ ] **Step 1: Failing test**

`apps/admin/app/_components/require-admin.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const useAuth = vi.fn();
vi.mock('./auth-provider', () => ({ useAuth: () => useAuth() }));

import { RequireAdmin } from './require-admin';

describe('RequireAdmin', () => {
  it('renders children when authed', () => {
    useAuth.mockReturnValue({ status: 'authed' });
    render(<RequireAdmin><p>panel</p></RequireAdmin>);
    expect(screen.getByText('panel')).toBeInTheDocument();
  });
  it('redirects non-admins to /login', () => {
    useAuth.mockReturnValue({ status: 'guest' });
    render(<RequireAdmin><p>panel</p></RequireAdmin>);
    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('panel')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail** — FAIL.

- [ ] **Step 3: Implement**

`apps/admin/app/_components/require-admin.tsx`:
```tsx
'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';

export function RequireAdmin({ children }: { children: ReactNode }) {
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

- [ ] **Step 5: Commit** — `git add apps/admin/app/_components/require-admin.tsx apps/admin/app/_components/require-admin.test.tsx && git commit -m "feat(admin): RequireAdmin route guard"`

---

### Task 5: AdminShell + login page + layout wiring

**Files:** Create `apps/admin/app/_components/admin-shell.tsx`, `apps/admin/app/login/page.tsx`; Modify `apps/admin/app/layout.tsx`, `apps/admin/app/page.tsx`.

**Interfaces:**
- `AdminShell({ children })` (client) — persistent left sidebar (Dashboard `/`, Products `/products`, Categories `/categories`, Orders `/orders`, Users `/users`) + topbar (admin email + logout); renders children in the content area. Wrapped by `RequireAdmin`.
- The root layout renders `AdminShell` around all pages **except** `/login` — since `/login` must be reachable while unauthenticated. Simplest: `AdminShell` (with `RequireAdmin`) is applied in a route group / by each page rather than the root layout. **Approach:** root layout only mounts `Providers`; each authed page wraps its content in `<AdminShell>`; `/login` does not. (A shared `AdminPage` wrapper keeps this DRY.)

- [ ] **Step 1: AdminShell**

`apps/admin/app/_components/admin-shell.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { RequireAdmin } from './require-admin';
import { useAuth } from './auth-provider';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/products', label: 'Products' },
  { href: '/categories', label: 'Categories' },
  { href: '/orders', label: 'Orders' },
  { href: '/users', label: 'Users' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <RequireAdmin>
      <div className="grid min-h-dvh grid-cols-[13rem_1fr]">
        <aside className="border-r border-hairline bg-surface">
          <div className="p-4 font-display text-lg font-semibold text-ink">Measured Admin</div>
          <nav className="flex flex-col p-2 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-sm px-3 py-2 text-graphite hover:bg-paper hover:text-accent">
                {n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex flex-col">
          <header className="flex items-center justify-end gap-4 border-b border-hairline px-6 py-3 text-sm">
            <span className="font-mono text-xs text-graphite">{user?.email}</span>
            <button onClick={() => logout()} className="text-graphite hover:text-accent">Log out</button>
          </header>
          <main className="p-6">{children}</main>
        </div>
      </div>
    </RequireAdmin>
  );
}
```

- [ ] **Step 2: Login page**

`apps/admin/app/login/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { loginInput, type LoginInput } from '@repo/types';
import { ApiError } from '@repo/api-client';
import { Button } from '@repo/ui';
import { useAuth } from '@/app/_components/auth-provider';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginInput) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values);
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Login failed');
    }
  });

  return (
    <main className="mx-auto mt-24 max-w-sm">
      <h1 className="font-display text-2xl font-semibold text-ink">Admin sign in</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="text-graphite">Email</span>
          <input type="email" {...register('email')} className="mt-1 w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-ink" />
          {errors.email && <span className="text-sm text-accent">{errors.email.message}</span>}
        </label>
        <label className="block text-sm">
          <span className="text-graphite">Password</span>
          <input type="password" {...register('password')} className="mt-1 w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-ink" />
          {errors.password && <span className="text-sm text-accent">{errors.password.message}</span>}
        </label>
        {error && <p className="text-sm text-accent">{error}</p>}
        <Button type="submit" disabled={isSubmitting} className="w-full">Sign in</Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Wrap the dashboard placeholder in AdminShell**

`apps/admin/app/page.tsx`:
```tsx
import { AdminShell } from './_components/admin-shell';

export default function DashboardPage() {
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>
      <p className="mt-2 text-graphite">Metrics arrive in M4.</p>
    </AdminShell>
  );
}
```

(`layout.tsx` stays as Task 2 wrote it — Providers only; `AdminShell` is applied per authed page so `/login` stays outside the guard.)

- [ ] **Step 4: Gates** — `pnpm --filter admin test`; `typecheck`; `lint`; `NODE_ENV=production pnpm --filter admin build` (routes `/`, `/login`). Reset `next-env.d.ts` before committing.

- [ ] **Step 5: Commit** — `git add apps/admin/app && git commit -m "feat(admin): admin shell, sidebar, and login page"`

---

### Task 6: Pipeline + verification

- [ ] **Step 1: Workspace pipeline** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `NODE_ENV=production pnpm build`. All green; `pnpm install --frozen-lockfile` consistent (record `apps/admin/package.json` + lock together).
- [ ] **Step 2: Live check** — start API + `NODE_ENV=production pnpm --filter admin start`; confirm `/login` returns 200 and (unauthenticated) `/` redirects to `/login`. Log in as the seeded admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) → dashboard placeholder renders; a CUSTOMER login is rejected with "admin access only".
- [ ] **Step 3: Commit any fixes.**

---

## Definition of Done (M1)

- `pnpm --filter admin dev` serves the admin on 3002; `/login` works; unauthenticated or CUSTOMER users can't reach the shell (redirected to `/login`); a seeded ADMIN reaches the dashboard placeholder.
- `@repo/api-client` exposes admin catalog + order-status functions (tested).
- `lint`, `typecheck`, `test` green across the workspace; `NODE_ENV=production pnpm build` green; frozen-lockfile consistent.
- No contract shapes redefined outside `@repo/types`; catalog CRUD UI, orders UI, users, dashboard, and E2E land in M2–M4.
