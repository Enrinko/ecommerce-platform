# Phase 2 · M1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the web foundation — `@repo/api-client`, `@repo/ui`, and an `apps/web` Next.js App Router skeleton — so later milestones build catalog/cart/checkout on top.

**Architecture:** RSC-first Next.js app (spec §6). Two new workspace packages consumed as **source** (no build step) via Next `transpilePackages`: `@repo/api-client` (isomorphic typed fetch wrappers over the Phase 1 API, types from `@repo/types`) and `@repo/ui` (shadcn/ui-style primitives + a shared Tailwind preset). Turbo already fans `lint`/`typecheck`/`test`/`build` across the workspace, so new packages join CI once they declare those scripts.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript 5.6 · Tailwind CSS 3.4 · TanStack Query 5 · class-variance-authority + clsx + tailwind-merge · Vitest 2.1 + @testing-library/react.

## Global Constraints

- Node `>=20`; package manager `pnpm@9.12.0` (root `package.json`). Run all commands inside the `dev` container: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; <cmd>"`.
- Web app listens on port **3001** (dev compose already sets `CORS_ORIGINS=http://localhost:3001,...`).
- API base URL from env `NEXT_PUBLIC_API_URL`, default `http://localhost:3000/api/v1`.
- Contracts come from `@repo/types` only — never redefine request/response shapes. List responses use the `{ items, total, page, limit }` envelope.
- `@repo/api-client` and `@repo/ui` are consumed as source; `apps/web/next.config.mjs` must list both (and `@repo/types`) in `transpilePackages`.
- New workspace packages MUST declare `lint`, `typecheck`, and (where they have tests) `test` scripts so Turbo/CI pick them up.
- Commit messages: Conventional Commits, English. Do not push or open a PR in M1 unless asked.

---

## File Structure

```
packages/
├─ api-client/
│  ├─ package.json                 # @repo/api-client, source exports, no build
│  ├─ tsconfig.json                # extends base; noEmit, DOM lib
│  ├─ eslint.config.mjs            # re-exports @repo/config/eslint
│  ├─ vitest.config.ts             # node env
│  └─ src/
│     ├─ http.ts                   # apiFetch + ApiError (core)
│     ├─ http.test.ts              # core tests (mocked fetch)
│     ├─ products.ts               # listProducts / getProduct
│     ├─ categories.ts             # listCategories
│     ├─ auth.ts                   # register/login/refresh/logout/me
│     ├─ cart.ts                   # get/add/update/remove
│     ├─ orders.ts                 # checkout/listMine/getOne
│     ├─ reviews.ts                # listByProduct/create
│     ├─ client.test.ts            # domain tests (mocked fetch)
│     └─ index.ts                  # barrel
├─ ui/
│  ├─ package.json                 # @repo/ui, source exports
│  ├─ tsconfig.json                # extends react preset
│  ├─ eslint.config.mjs            # re-exports @repo/config/eslint
│  ├─ vitest.config.ts             # jsdom env
│  ├─ vitest.setup.ts              # @testing-library/jest-dom
│  ├─ tailwind-preset.ts           # shared Tailwind tokens
│  └─ src/
│     ├─ cn.ts                     # clsx + tailwind-merge
│     ├─ button.tsx                # Button primitive (cva)
│     ├─ button.test.tsx           # render test
│     └─ index.ts                  # barrel
├─ config/
│  └─ tsconfig.react.json          # NEW: base + jsx + DOM (for .tsx typecheck)
apps/
└─ web/
   ├─ package.json                 # next/react deps + scripts
   ├─ next.config.mjs              # transpilePackages + eslint.ignoreDuringBuilds
   ├─ tsconfig.json                # Next-flavored
   ├─ next-env.d.ts                # committed (not gitignored) so tsc typechecks standalone
   ├─ tailwind.config.ts           # uses @repo/ui preset
   ├─ postcss.config.mjs
   ├─ eslint.config.mjs            # re-exports @repo/config/eslint
   ├─ vitest.config.ts             # jsdom env
   ├─ vitest.setup.ts
   ├─ .env.example                 # NEXT_PUBLIC_API_URL
   └─ app/
      ├─ globals.css               # tailwind layers
      ├─ layout.tsx                # root layout + Providers
      ├─ providers.tsx             # QueryClientProvider
      ├─ providers.test.tsx        # smoke render
      └─ page.tsx                  # home placeholder
```

> **ESLint pattern (matches existing packages):** every workspace member has an
> `eslint.config.mjs` that is exactly `export { default } from '@repo/config/eslint';`
> and does NOT list `eslint`/`typescript-eslint` as direct deps (resolved from
> `@repo/config`). New packages mirror this. React-specific lint (react-hooks)
> is deferred to M3, when hooks first appear.

Dependency order: `@repo/types` (exists) → **Task 1–2** api-client → **Task 3** ui → **Task 4–5** web → **Task 6** pipeline check.

---

### Task 1: `@repo/api-client` — HTTP core + ApiError

**Files:**
- Create: `packages/api-client/package.json`
- Create: `packages/api-client/tsconfig.json`
- Create: `packages/api-client/vitest.config.ts`
- Create: `packages/api-client/src/http.ts`
- Test: `packages/api-client/src/http.test.ts`

**Interfaces:**
- Produces: `class ApiError extends Error { status: number; message: string; errors?: Record<string,string[]> }`; `interface RequestOptions { baseUrl?: string; accessToken?: string; init?: RequestInit }`; `apiFetch<T>(path: string, opts?: RequestOptions): Promise<T>`.

- [ ] **Step 1: Scaffold the package**

`packages/api-client/package.json`:
```json
{
  "name": "@repo/api-client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": { "@repo/types": "workspace:*" },
  "devDependencies": {
    "@repo/config": "workspace:*",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/api-client/tsconfig.json`:
```json
{
  "extends": "@repo/config/tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

`packages/api-client/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'node' } });
```

`packages/api-client/eslint.config.mjs`:
```js
export { default } from '@repo/config/eslint';
```

Then install so the workspace links: run
`docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm install"`

- [ ] **Step 2: Write the failing test**

`packages/api-client/src/http.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './http';

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('apiFetch', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { id: '1' }));
    await expect(apiFetch('/x', { baseUrl: 'http://api' })).resolves.toEqual({ id: '1' });
  });

  it('throws ApiError carrying status, message and field errors', async () => {
    vi.stubGlobal('fetch', mockFetch(400, { statusCode: 400, message: 'Validation failed', errors: { email: ['Invalid'] } }));
    await expect(apiFetch('/x', { baseUrl: 'http://api' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Validation failed',
      errors: { email: ['Invalid'] },
    });
  });

  it('sends a Bearer header when an access token is given', async () => {
    const spy = mockFetch(200, {});
    vi.stubGlobal('fetch', spy);
    await apiFetch('/x', { baseUrl: 'http://api', accessToken: 'tok' });
    const headers = new Headers((spy.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get('authorization')).toBe('Bearer tok');
  });
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter @repo/api-client test"`
Expected: FAIL — `Cannot find module './http'` / `ApiError is not exported`.

- [ ] **Step 4: Implement `http.ts`**

`packages/api-client/src/http.ts`:
```ts
export interface ApiErrorBody {
  statusCode: number;
  message: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: Record<string, string[]>;
  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export interface RequestOptions {
  baseUrl?: string;
  accessToken?: string;
  init?: RequestInit;
}

const DEFAULT_BASE = 'http://localhost:3000/api/v1';

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const baseUrl =
    opts.baseUrl ??
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : undefined) ??
    DEFAULT_BASE;

  const headers = new Headers(opts.init?.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  if (opts.accessToken) headers.set('authorization', `Bearer ${opts.accessToken}`);

  const res = await fetch(`${baseUrl}${path}`, {
    ...opts.init,
    headers,
    credentials: 'include',
  });

  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const b = (body ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(res.status, b.message ?? res.statusText, b.errors);
  }
  return body as T;
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter @repo/api-client test"`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/api-client pnpm-lock.yaml
git commit -m "feat(api-client): typed HTTP core with ApiError"
```

---

### Task 2: `@repo/api-client` — domain modules

**Files:**
- Create: `packages/api-client/src/products.ts`, `categories.ts`, `auth.ts`, `cart.ts`, `orders.ts`, `reviews.ts`
- Create: `packages/api-client/src/index.ts`
- Test: `packages/api-client/src/client.test.ts`

**Interfaces:**
- Consumes: `apiFetch`, `RequestOptions` from Task 1; types from `@repo/types` (`Paginated`, `Product`, `ProductListQuery`, `Category`, `RegisterInput`, `LoginInput`, `AuthTokens`, `MeResponse`, `AddCartItemInput`, `CreateOrderInput`, `CreateReviewInput`, `PageQuery`).
- Produces (barrel `index.ts`): `listProducts`, `getProduct`, `listCategories`, `register`, `login`, `refresh`, `logout`, `me`, `getCart`, `addCartItem`, `updateCartItem`, `removeCartItem`, `checkout`, `listMyOrders`, `getOrder`, `listReviews`, `createReview`, plus `ApiError`, `RequestOptions`.

- [ ] **Step 1: Write the failing test**

`packages/api-client/src/client.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listProducts, login } from './index';

afterEach(() => vi.unstubAllGlobals());

function capture(status: number, body: unknown) {
  const spy = vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

describe('domain client', () => {
  it('builds a products query string, skipping undefined params', async () => {
    const spy = capture(200, { items: [], total: 0, page: 1, limit: 20 });
    await listProducts({ category: 'audio', page: 2, q: undefined }, { baseUrl: 'http://api' });
    const url = spy.mock.calls[0][0] as string;
    expect(url).toBe('http://api/products?category=audio&page=2');
  });

  it('POSTs credentials on login', async () => {
    const spy = capture(201, { accessToken: 'a', refreshToken: 'r' });
    await login({ email: 'e@x.io', password: 'pw' }, { baseUrl: 'http://api' });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'e@x.io', password: 'pw' });
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter @repo/api-client test"`
Expected: FAIL — `listProducts`/`login` not exported.

- [ ] **Step 3: Implement the domain modules**

`packages/api-client/src/products.ts`:
```ts
import type { Paginated, Product, ProductListQuery } from '@repo/types';
import { apiFetch, type RequestOptions } from './http';

export type ProductDetail = Product & { rating: { avg: number; count: number } };

export function listProducts(
  query: Partial<ProductListQuery> = {},
  opts?: RequestOptions,
): Promise<Paginated<Product>> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<Paginated<Product>>(`/products${suffix}`, opts);
}

export function getProduct(slug: string, opts?: RequestOptions): Promise<ProductDetail> {
  return apiFetch<ProductDetail>(`/products/${slug}`, opts);
}
```

`packages/api-client/src/categories.ts`:
```ts
import type { Category } from '@repo/types';
import { apiFetch, type RequestOptions } from './http';

export function listCategories(opts?: RequestOptions): Promise<Category[]> {
  return apiFetch<Category[]>('/categories', opts);
}
```

`packages/api-client/src/auth.ts`:
```ts
import type { AuthTokens, LoginInput, MeResponse, RegisterInput } from '@repo/types';
import { apiFetch, type RequestOptions } from './http';

const post = (body: unknown, opts?: RequestOptions): RequestOptions => ({
  ...opts,
  init: { ...opts?.init, method: 'POST', body: JSON.stringify(body) },
});

export function register(input: RegisterInput, opts?: RequestOptions): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/register', post(input, opts));
}
export function login(input: LoginInput, opts?: RequestOptions): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/login', post(input, opts));
}
export function refresh(opts?: RequestOptions): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/refresh', { ...opts, init: { ...opts?.init, method: 'POST' } });
}
export function logout(opts?: RequestOptions): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/auth/logout', { ...opts, init: { ...opts?.init, method: 'POST' } });
}
export function me(opts?: RequestOptions): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me', opts);
}
```

`packages/api-client/src/cart.ts`:
```ts
import type { AddCartItemInput } from '@repo/types';
import { apiFetch, type RequestOptions } from './http';

// Cart response shape is owned by the API; typed loosely here until a Cart
// contract is added to @repo/types (tracked for M3).
export type Cart = { id: string; items: Array<{ productId: string; qty: number; product: unknown }> };

export function getCart(opts?: RequestOptions): Promise<Cart> {
  return apiFetch<Cart>('/cart', opts);
}
export function addCartItem(input: AddCartItemInput, opts?: RequestOptions): Promise<Cart> {
  return apiFetch<Cart>('/cart/items', { ...opts, init: { ...opts?.init, method: 'POST', body: JSON.stringify(input) } });
}
export function updateCartItem(productId: string, qty: number, opts?: RequestOptions): Promise<Cart> {
  return apiFetch<Cart>(`/cart/items/${productId}`, { ...opts, init: { ...opts?.init, method: 'PATCH', body: JSON.stringify({ qty }) } });
}
export function removeCartItem(productId: string, opts?: RequestOptions): Promise<Cart> {
  return apiFetch<Cart>(`/cart/items/${productId}`, { ...opts, init: { ...opts?.init, method: 'DELETE' } });
}
```

`packages/api-client/src/orders.ts`:
```ts
import type { CreateOrderInput, PageQuery } from '@repo/types';
import { apiFetch, type RequestOptions } from './http';

export type Order = { id: string; status: string; totalCents: number; currency: string; items: unknown[] };
export type OrderList = { items: Order[]; total: number; page: number; limit: number };

export function checkout(input: CreateOrderInput, opts?: RequestOptions): Promise<Order> {
  return apiFetch<Order>('/orders', { ...opts, init: { ...opts?.init, method: 'POST', body: JSON.stringify(input) } });
}
export function listMyOrders(query: Partial<PageQuery> = {}, opts?: RequestOptions): Promise<OrderList> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined) qs.set(k, String(v));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<OrderList>(`/orders${suffix}`, opts);
}
export function getOrder(id: string, opts?: RequestOptions): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}`, opts);
}
```

`packages/api-client/src/reviews.ts`:
```ts
import type { CreateReviewInput, PageQuery, ProductRating } from '@repo/types';
import { apiFetch, type RequestOptions } from './http';

export type ReviewList = {
  items: Array<{ productId: string; userId: string; rating: number; title: string; body: string }>;
  total: number;
  page: number;
  limit: number;
  rating: ProductRating;
};

export function listReviews(productId: string, query: Partial<PageQuery> = {}, opts?: RequestOptions): Promise<ReviewList> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined) qs.set(k, String(v));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<ReviewList>(`/products/${productId}/reviews${suffix}`, opts);
}
export function createReview(productId: string, input: CreateReviewInput, opts?: RequestOptions): Promise<ReviewList> {
  return apiFetch<ReviewList>(`/products/${productId}/reviews`, { ...opts, init: { ...opts?.init, method: 'POST', body: JSON.stringify(input) } });
}
```

`packages/api-client/src/index.ts`:
```ts
export { ApiError } from './http';
export type { ApiErrorBody, RequestOptions } from './http';
export * from './products';
export * from './categories';
export * from './auth';
export * from './cart';
export * from './orders';
export * from './reviews';
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter @repo/api-client test"`
Expected: PASS (2 new tests + 3 from Task 1 = 5).

- [ ] **Step 5: Typecheck**

Run: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter @repo/api-client typecheck"`
Expected: no output, exit 0. (If `@repo/types` types are stale, run `pnpm --filter @repo/types build` first.)

- [ ] **Step 6: Commit**

```bash
git add packages/api-client
git commit -m "feat(api-client): typed domain wrappers for all API resources"
```

---

### Task 3: `@repo/config` React presets + `@repo/ui` (cn + Button)

**Files:**
- Create: `packages/config/tsconfig.react.json`
- Modify: `packages/config/package.json` (export the new tsconfig)
- Create: `packages/ui/package.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `tailwind-preset.ts`
- Create: `packages/ui/src/cn.ts`, `packages/ui/src/button.tsx`, `packages/ui/src/index.ts`
- Test: `packages/ui/src/button.test.tsx`

**Interfaces:**
- Produces: `cn(...classes): string`; `Button` (React FC accepting `variant?: 'default'|'outline'|'ghost'`, `size?: 'default'|'sm'|'lg'`, plus native button props); default export of Tailwind preset from `tailwind-preset.ts`.

- [ ] **Step 1: Add the React TS preset**

`packages/config/tsconfig.react.json`:
```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "noEmit": true
  }
}
```

Modify `packages/config/package.json` — add `tsconfig.react.json` to `files` and `exports` (leave the eslint export and deps unchanged; React ESLint is deferred to M3):
```json
{
  "name": "@repo/config",
  "version": "0.0.0",
  "private": true,
  "files": ["tsconfig.base.json", "tsconfig.react.json", "eslint.config.mjs"],
  "exports": {
    "./tsconfig.base.json": "./tsconfig.base.json",
    "./tsconfig.react.json": "./tsconfig.react.json",
    "./eslint": "./eslint.config.mjs"
  },
  "devDependencies": {
    "eslint": "^9.12.0",
    "typescript-eslint": "^8.8.0"
  }
}
```

- [ ] **Step 2: Scaffold `@repo/ui`**

`packages/ui/package.json`:
```json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
    "./tailwind-preset": "./tailwind-preset.ts"
  },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.0"
  },
  "peerDependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" },
  "devDependencies": {
    "@repo/config": "workspace:*",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^25.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/ui/tsconfig.json`:
```json
{
  "extends": "@repo/config/tsconfig.react.json",
  "include": ["src/**/*.ts", "src/**/*.tsx", "tailwind-preset.ts"]
}
```

`packages/ui/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'], globals: true },
});
```

`packages/ui/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`packages/ui/tailwind-preset.ts`:
```ts
import type { Config } from 'tailwindcss';

// Shared design tokens for web (and later admin). Apps extend this preset.
const preset = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4f46e5',
          fg: '#ffffff',
        },
      },
      borderRadius: { md: '0.5rem' },
    },
  },
} satisfies Partial<Config>;

export default preset;
```

`packages/ui/eslint.config.mjs`:
```js
export { default } from '@repo/config/eslint';
```

Then install: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm install"`

- [ ] **Step 3: Write the failing test**

`packages/ui/src/button.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './index';

describe('Button', () => {
  it('renders its children as a button', () => {
    render(<Button>Buy now</Button>);
    expect(screen.getByRole('button', { name: 'Buy now' })).toBeInTheDocument();
  });

  it('applies an outline variant class', () => {
    render(<Button variant="outline">Cancel</Button>);
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('border');
  });

  it('merges a caller className', () => {
    render(<Button className="w-full">Wide</Button>);
    expect(screen.getByRole('button', { name: 'Wide' }).className).toContain('w-full');
  });
});
```

- [ ] **Step 4: Run the test, verify it fails**

Run: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter @repo/ui test"`
Expected: FAIL — cannot resolve `./index` / `Button`.

- [ ] **Step 5: Implement `cn`, `Button`, barrel**

`packages/ui/src/cn.ts`:
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

`packages/ui/src/button.tsx`:
```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-brand text-brand-fg hover:bg-brand/90',
        outline: 'border border-input bg-transparent hover:bg-accent',
        ghost: 'hover:bg-accent',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
```

`packages/ui/src/index.ts`:
```ts
export { cn } from './cn';
export { Button, type ButtonProps } from './button';
```

- [ ] **Step 6: Run the test, verify it passes**

Run: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter @repo/ui test"`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/config packages/ui pnpm-lock.yaml
git commit -m "feat(ui): shared Tailwind preset and Button primitive"
```

---

### Task 4: `apps/web` — Next.js App Router skeleton

**Files:**
- Create: `apps/web/package.json`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.env.example`
- Create: `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `@repo/ui` (`Button`), `@repo/ui/tailwind-preset`.
- Produces: a buildable Next app on port 3001 with a root layout and home page.

- [ ] **Step 1: Scaffold the app config**

`apps/web/package.json`:
```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@repo/api-client": "workspace:*",
    "@repo/types": "workspace:*",
    "@repo/ui": "workspace:*",
    "@tanstack/react-query": "^5.59.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
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

> ESLint is not a direct dep (mirrors `apps/api`): it resolves from `@repo/config`.
> Linting runs as its own Turbo task, decoupled from `next build` (see `next.config.mjs`).

`apps/web/next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages are shipped as source; Next must transpile them.
  transpilePackages: ['@repo/ui', '@repo/api-client', '@repo/types'],
  // Lint is a separate Turbo task (`pnpm lint`); don't run it during build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "@repo/config/tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "noEmit": true,
    "allowJs": true,
    "incremental": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';
import preset from '@repo/ui/tailwind-preset';

export default {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
} satisfies Config;
```

`apps/web/postcss.config.mjs`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`apps/web/eslint.config.mjs`:
```js
export { default } from '@repo/config/eslint';
```
(The base config already ignores `.next/**` and `node_modules/**`.)

`apps/web/.env.example`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

`apps/web/next-env.d.ts` (committed so `tsc --noEmit` typechecks standalone in CI, which runs `typecheck` before `build`):
```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
```

- [ ] **Step 2: Add the app shell**

`apps/web/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`apps/web/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Storefront',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`apps/web/app/page.tsx`:
```tsx
import { Button } from '@repo/ui';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Storefront</h1>
      <p className="mt-2 text-sm">Phase 2 foundation is up.</p>
      <Button className="mt-4">Shop now</Button>
    </main>
  );
}
```

- [ ] **Step 3: Install and verify the build**

Run:
```
docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm install && pnpm --filter web build"
```
Expected: install links `web`; `next build` creates `next-env.d.ts` and compiles with no type errors; output ends with the route table listing `/` as a static route.

- [ ] **Step 4: Verify typecheck and lint**

Run:
```
docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter web typecheck && pnpm --filter web lint"
```
Expected: both exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git add apps/web packages/config pnpm-lock.yaml
git commit -m "feat(web): Next.js App Router skeleton with Tailwind and @repo/ui"
```

---

### Task 5: `apps/web` — providers (TanStack Query)

**Files:**
- Create: `apps/web/app/providers.tsx`
- Modify: `apps/web/app/layout.tsx` (wrap children in `Providers`)
- Create: `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`
- Test: `apps/web/app/providers.test.tsx`

**Interfaces:**
- Produces: `Providers` client component wrapping children in a `QueryClientProvider` with a stable `QueryClient`.

- [ ] **Step 1: Add Vitest config for the app**

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'], globals: true },
});
```

`apps/web/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Write the failing test**

`apps/web/app/providers.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { Providers } from './providers';

function Probe() {
  const { data } = useQuery({ queryKey: ['probe'], queryFn: () => 'ready' });
  return <span>{data ?? 'loading'}</span>;
}

describe('Providers', () => {
  it('supplies a QueryClient to descendants', async () => {
    render(
      <Providers>
        <Probe />
      </Providers>,
    );
    expect(await screen.findByText('ready')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter web test"`
Expected: FAIL — cannot resolve `./providers`.

- [ ] **Step 4: Implement `Providers` and wire the layout**

`apps/web/app/providers.tsx`:
```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

Modify `apps/web/app/layout.tsx` — wrap `children`:
```tsx
import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Storefront',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter web test"`
Expected: PASS (1 test).

- [ ] **Step 6: Verify build still succeeds**

Run: `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter web build"`
Expected: build succeeds; `/` still renders (now wrapped in Providers).

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): TanStack Query provider in the root layout"
```

---

### Task 6: Verify the Turbo pipeline covers web + packages

**Files:**
- Modify (only if a gap is found): `.github/workflows/ci.yml`

**Interfaces:** none (integration checkpoint).

- [ ] **Step 1: Run the full workspace pipeline as CI would**

Run:
```
docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build"
```
Expected: Turbo runs `lint`/`typecheck`/`test`/`build` across `api`, `web`, `@repo/api-client`, `@repo/ui`, `@repo/types`, `@repo/config`. All green. `@repo/api-client` (5) and `@repo/ui` (3) and `web` (1) test suites run under `pnpm test`.

- [ ] **Step 2: Confirm CI needs no web-specific change**

`.github/workflows/ci.yml` already runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (Turbo fans across the workspace). New packages/app are picked up automatically because they declare those scripts. No edit required for M1. (Playwright E2E job is added in M4.)

Verify by inspection: the four Turbo commands in `ci.yml` (lines 45–47, 51) cover the new workspace members. If `pnpm test` in Step 1 did NOT include the new suites, add their scripts — otherwise no change.

- [ ] **Step 3: Commit (only if `ci.yml` changed)**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: cover web app and shared packages"
```

If no change was needed, skip this commit — M1 is complete.

---

## Definition of Done (M1)

- `pnpm --filter web dev` serves the home page on `http://localhost:3001`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` are green across the workspace.
- `@repo/api-client` and `@repo/ui` are consumable from `apps/web` (source via `transpilePackages`).
- No API contract is redefined outside `@repo/types` (cart/order/review response shapes are locally typed as interim `unknown`-ish types, to be promoted to `@repo/types` in M3 — noted in `cart.ts`).
