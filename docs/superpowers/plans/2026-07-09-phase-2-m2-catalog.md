# Phase 2 · M2 — Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the shopper-facing catalog on the M1 foundation — home, `/products` (filters + pagination + sort), and `/products/[slug]` (with reviews + rating) — server-rendered, responsive, in the "Measured" visual identity.

**Architecture:** RSC-first (spec §6). Public pages are React Server Components that fetch from the Phase 1 API through `@repo/api-client`; interactive controls (search/filter/sort) are small client components that drive the URL's searchParams. Data pages render dynamically (no build-time API dependency). Visual identity lives in `@repo/ui` tokens + a few web-local components.

**Tech Stack:** Next.js 15 (App Router, RSC) · `@repo/api-client` · `@repo/ui` (Tailwind preset) · Tailwind 3.4 · next/font (Space Grotesk, Inter, IBM Plex Mono) · Vitest + @testing-library/react.

## Global Constraints

- **Design system — "Measured"** (use these exact tokens):
  - Colors: `paper #EFEEE9` (page bg) · `surface #FFFFFF` (cards) · `ink #17171B` (text) · `graphite #70707A` (muted/labels) · `hairline #DAD8D1` (borders/dividers) · `accent #2440F0` (cobalt: CTAs, links, active) · `accent-ink #FFFFFF`.
  - Type roles: **display** = Space Grotesk (headings), **body** = Inter (UI/paragraphs), **mono** = IBM Plex Mono (prices, SKUs, numeric/spec data ONLY — never body).
  - Radii: crisp — `sm 2px`, `md 4px`. No large pill radii.
  - Signature (use with restraint): a tick-mark "ruler" divider (CSS `repeating-linear-gradient`, no image asset) under the header and as section rules; prices set in mono.
- Contracts come from `@repo/types` only. Query parsing uses `productListQuery` from `@repo/types`; never hand-roll param shapes.
- Data pages (`/products`, `/products/[slug]`, home featured list) are dynamic: add `export const dynamic = 'force-dynamic'`. Do NOT use `generateStaticParams` (keeps builds free of a live API, matching M1).
- Server components call `@repo/api-client` functions directly; base URL is `NEXT_PUBLIC_API_URL` (default `http://localhost:3000/api/v1`). Public catalog endpoints need no auth.
- Commands run inside the `fullstack-dev-1` container. **Local production build must use `NODE_ENV=production`** (`NODE_ENV=production pnpm --filter web build`) — the dev container forces `NODE_ENV=development`, which breaks Next's production SSR of error pages. `typecheck`/`lint`/`test` run without the override. CI is unaffected.
- Images: products carry `images: string[]` of arbitrary URLs. Render a styled placeholder frame by default; if a URL is present use a plain `<img loading="lazy">` with `object-cover` (no `next/image` remotePatterns config, no external asset dependency).
- Quality floor: responsive mobile-first, visible keyboard focus, `prefers-reduced-motion` respected. Conventional Commits; no push/PR until asked.

---

## File Structure

```
packages/ui/
├─ tailwind-preset.ts              # UPDATE → Measured tokens (palette, fonts, radii)
└─ src/
   ├─ button.tsx                   # UPDATE → accent tokens
   ├─ price.tsx                    # NEW → mono price
   ├─ rating.tsx                   # NEW → star rating (avg + count)
   ├─ price.test.tsx / rating.test.tsx
   └─ index.ts                     # UPDATE → export Price, Rating
apps/web/
├─ app/
│  ├─ globals.css                  # UPDATE → font vars, base, .ruler utility
│  ├─ layout.tsx                   # UPDATE → next/font vars, SiteHeader/Footer
│  ├─ page.tsx                     # UPDATE → home (hero + featured)
│  ├─ products/
│  │  ├─ page.tsx                  # NEW → catalog (RSC, dynamic)
│  │  └─ [slug]/page.tsx           # NEW → product detail (RSC) + reviews
│  └─ _components/
│     ├─ site-header.tsx           # NEW → wordmark + category nav
│     ├─ ruler.tsx                 # NEW → tick divider
│     ├─ product-card.tsx          # NEW → spec-card
│     ├─ product-grid.tsx          # NEW
│     ├─ catalog-controls.tsx      # NEW (client) → search/category/sort/price → URL
│     ├─ pagination.tsx            # NEW → prev/next + page count
│     └─ review-list.tsx           # NEW
└─ lib/
   ├─ format.ts                    # NEW → formatPrice, formatCount (+ test)
   ├─ catalog-params.ts            # NEW → parse searchParams / build hrefs (+ test)
   └─ *.test.ts
```

Order: tokens (T1) → pure logic (T2) → primitives (T3) → card/grid (T4) → catalog page (T5) → product detail (T6) → header + home (T7) → pipeline + visual pass (T8).

---

### Task 1: "Measured" design tokens + typography

**Files:**
- Modify: `packages/ui/tailwind-preset.ts`, `packages/ui/src/button.tsx`
- Modify: `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/tailwind.config.ts`

**Interfaces:**
- Produces Tailwind tokens usable as classes: `bg-paper`, `bg-surface`, `text-ink`, `text-graphite`, `border-hairline`, `bg-accent`, `text-accent`, `text-accent-ink`, `font-display`, `font-mono`, `rounded-md` (4px); and a `.ruler` CSS utility.

- [ ] **Step 1: Rewrite the Tailwind preset with Measured tokens**

`packages/ui/tailwind-preset.ts`:
```ts
import type { Config } from 'tailwindcss';

// "Measured" — a precision-instrument identity for an everyday-tech shop.
const preset = {
  theme: {
    extend: {
      colors: {
        paper: '#EFEEE9',
        surface: '#FFFFFF',
        ink: '#17171B',
        graphite: '#70707A',
        hairline: '#DAD8D1',
        accent: { DEFAULT: '#2440F0', ink: '#FFFFFF' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { sm: '2px', md: '4px' },
    },
  },
} satisfies Partial<Config>;

export default preset;
```

- [ ] **Step 2: Point Button at the accent token**

`packages/ui/src/button.tsx` — change only the `variant` class strings:
```tsx
      variant: {
        default: 'bg-accent text-accent-ink hover:bg-accent/90',
        outline: 'border border-hairline bg-transparent text-ink hover:bg-paper',
        ghost: 'text-ink hover:bg-paper',
      },
```
(Everything else in the file is unchanged. The existing `button.test.tsx` still passes: `default` has no `border`, `outline` contains `border`.)

- [ ] **Step 3: Wire fonts + base styles**

`apps/web/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { Space_Grotesk, Inter, IBM_Plex_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Measured — everyday tech', template: '%s · Measured' },
  description: 'Precisely chosen everyday tech and accessories.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-paper font-body text-ink antialiased">{children}</body>
    </html>
  );
}
```
(SiteHeader/Footer are added in Task 7; keep the body wrapper minimal here.)

`apps/web/app/globals.css`:
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

@layer components {
  /* Signature: a precision "ruler" tick rule. */
  .ruler {
    height: 8px;
    background-image: repeating-linear-gradient(
      to right,
      theme('colors.hairline') 0,
      theme('colors.hairline') 1px,
      transparent 1px,
      transparent 8px
    );
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
```

`apps/web/tailwind.config.ts` — ensure the content globs cover components + lib:
```ts
import type { Config } from 'tailwindcss';
import preset from '@repo/ui/tailwind-preset';

export default {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
} satisfies Config;
```

- [ ] **Step 4: Verify gates**

Run (container): `pnpm --filter @repo/ui test` (Button 3/3), `pnpm --filter web typecheck`, `pnpm --filter web lint`, `NODE_ENV=production pnpm --filter web build`.
Expected: all green; home still renders (restyled).

- [ ] **Step 5: Commit**
```bash
git add packages/ui apps/web/app/layout.tsx apps/web/app/globals.css apps/web/tailwind.config.ts
git commit -m "feat(ui): Measured design tokens and typography foundation"
```

---

### Task 2: Catalog params + formatting helpers (pure logic, TDD)

**Files:**
- Create: `apps/web/lib/catalog-params.ts`, `apps/web/lib/format.ts`
- Test: `apps/web/lib/catalog-params.test.ts`, `apps/web/lib/format.test.ts`

**Interfaces:**
- Produces: `parseCatalogParams(sp: Record<string,string|string[]|undefined>): ProductListQuery` (validates via `productListQuery` from `@repo/types`, falling back to defaults on invalid input); `catalogHref(params: Partial<ProductListQuery>): string` (e.g. `/products?category=audio&page=2`); `formatPrice(cents: number, currency: string): string` (e.g. `$19.00`); `formatCount(n: number, noun: string): string` (e.g. `3 reviews`).

- [ ] **Step 1: Write failing tests**

`apps/web/lib/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatPrice, formatCount } from './format';

describe('formatPrice', () => {
  it('renders cents as major units with a currency symbol', () => {
    expect(formatPrice(1900, 'USD')).toBe('$19.00');
    expect(formatPrice(150, 'EUR')).toBe('€1.50');
  });
});

describe('formatCount', () => {
  it('pluralizes the noun', () => {
    expect(formatCount(1, 'review')).toBe('1 review');
    expect(formatCount(3, 'review')).toBe('3 reviews');
    expect(formatCount(0, 'review')).toBe('No reviews');
  });
});
```

`apps/web/lib/catalog-params.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseCatalogParams, catalogHref } from './catalog-params';

describe('parseCatalogParams', () => {
  it('applies defaults for empty params', () => {
    expect(parseCatalogParams({})).toMatchObject({ page: 1, limit: 20, sort: 'newest' });
  });
  it('coerces and passes through known params', () => {
    const q = parseCatalogParams({ category: 'audio', page: '2', sort: 'price_asc' });
    expect(q).toMatchObject({ category: 'audio', page: 2, sort: 'price_asc' });
  });
  it('falls back to defaults on invalid input', () => {
    expect(parseCatalogParams({ page: 'abc', sort: 'bogus' })).toMatchObject({ page: 1, sort: 'newest' });
  });
});

describe('catalogHref', () => {
  it('builds a query string, skipping undefined', () => {
    expect(catalogHref({ category: 'audio', page: 2, q: undefined })).toBe('/products?category=audio&page=2');
  });
  it('returns bare /products with no params', () => {
    expect(catalogHref({})).toBe('/products');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm --filter web test` — FAIL (modules missing).

- [ ] **Step 3: Implement**

`apps/web/lib/format.ts`:
```ts
const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };

export function formatPrice(cents: number, currency: string): string {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export function formatCount(n: number, noun: string): string {
  if (n === 0) return `No ${noun}s`;
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
```

`apps/web/lib/catalog-params.ts`:
```ts
import { productListQuery, type ProductListQuery } from '@repo/types';

type RawParams = Record<string, string | string[] | undefined>;

// Validate incoming searchParams against the shared contract; on any invalid
// field, fall back to the schema defaults rather than 500ing a public page.
export function parseCatalogParams(sp: RawParams): ProductListQuery {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') flat[k] = v[0];
  }
  const parsed = productListQuery.safeParse(flat);
  return parsed.success ? parsed.data : productListQuery.parse({});
}

export function catalogHref(params: Partial<ProductListQuery>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `/products?${s}` : '/products';
}
```

- [ ] **Step 4: Run tests, verify pass** — `pnpm --filter web test` green (3 files: providers + format + catalog-params).

- [ ] **Step 5: Commit**
```bash
git add apps/web/lib
git commit -m "feat(web): catalog param parsing and price/count formatting"
```

---

### Task 3: Price + Rating primitives (@repo/ui)

**Files:**
- Create: `packages/ui/src/price.tsx`, `packages/ui/src/rating.tsx`, tests
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- `Price({ cents, currency, className? })` → mono span, e.g. `$19.00`.
- `Rating({ avg, count, className? })` → 5-star row (filled to `Math.round(avg)`) + mono `avg`/count label; renders a muted "No reviews" when `count === 0`.

- [ ] **Step 1: Failing tests**

`packages/ui/src/price.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Price } from './index';

describe('Price', () => {
  it('renders a monospaced formatted price', () => {
    render(<Price cents={1900} currency="USD" />);
    const el = screen.getByText('$19.00');
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('font-mono');
  });
});
```

`packages/ui/src/rating.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Rating } from './index';

describe('Rating', () => {
  it('shows the average and count when reviewed', () => {
    render(<Rating avg={4.2} count={3} />);
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText(/3 reviews/)).toBeInTheDocument();
  });
  it('shows an empty state when unrated', () => {
    render(<Rating avg={0} count={0} />);
    expect(screen.getByText(/no reviews/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter @repo/ui test` FAIL (missing exports).

- [ ] **Step 3: Implement**

`packages/ui/src/price.tsx`:
```tsx
import { cn } from './cn';

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };

export function Price({
  cents,
  currency,
  className,
}: {
  cents: number;
  currency: string;
  className?: string;
}) {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  return (
    <span className={cn('font-mono tabular-nums text-ink', className)}>
      {symbol}
      {(cents / 100).toFixed(2)}
    </span>
  );
}
```

`packages/ui/src/rating.tsx`:
```tsx
import { cn } from './cn';

export function Rating({
  avg,
  count,
  className,
}: {
  avg: number;
  count: number;
  className?: string;
}) {
  if (count === 0) {
    return <span className={cn('text-sm text-graphite', className)}>No reviews yet</span>;
  }
  const filled = Math.round(avg);
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <span aria-hidden className="text-accent">
        {'★'.repeat(filled)}
        <span className="text-hairline">{'★'.repeat(5 - filled)}</span>
      </span>
      <span className="font-mono text-ink">{avg.toFixed(1)}</span>
      <span className="text-graphite">
        {count} review{count === 1 ? '' : 's'}
      </span>
    </span>
  );
}
```

`packages/ui/src/index.ts` — append:
```ts
export { Price } from './price';
export { Rating } from './rating';
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter @repo/ui test` green (Button + Price + Rating).

- [ ] **Step 5: Commit**
```bash
git add packages/ui
git commit -m "feat(ui): Price and Rating primitives"
```

---

### Task 4: ProductCard + ProductGrid (web)

**Files:**
- Create: `apps/web/app/_components/product-card.tsx`, `apps/web/app/_components/product-grid.tsx`
- Test: `apps/web/app/_components/product-card.test.tsx`

**Interfaces:**
- Consumes: `Product` (+ optional `rating`) from `@repo/types` / api-client; `Price`, `Rating` from `@repo/ui`; `formatPrice` not needed (Price handles it).
- `ProductCard({ product })` → a Measured "spec card": image/placeholder frame, category eyebrow (mono, uppercase), title (display), Price. Links to `/products/[slug]`.
- `ProductGrid({ products })` → responsive grid of ProductCard.

- [ ] **Step 1: Failing test**

`apps/web/app/_components/product-card.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductCard } from './product-card';

const product = {
  id: '1',
  title: 'USB-C Cable',
  slug: 'usb-c-cable',
  description: 'Braided.',
  priceCents: 1900,
  currency: 'USD',
  stock: 50,
  images: [],
  isActive: true,
  categoryId: 'c1',
  category: { id: 'c1', name: 'Cables', slug: 'cables' },
  createdAt: new Date().toISOString(),
} as never;

describe('ProductCard', () => {
  it('links to the product and shows title + mono price', () => {
    render(<ProductCard product={product} />);
    const link = screen.getByRole('link', { name: /usb-c cable/i });
    expect(link).toHaveAttribute('href', '/products/usb-c-cable');
    const price = screen.getByText('$19.00');
    expect(price.className).toContain('font-mono');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter web test` FAIL.

- [ ] **Step 3: Implement**

`apps/web/app/_components/product-card.tsx`:
```tsx
import Link from 'next/link';
import { Price } from '@repo/ui';
import type { Product } from '@repo/types';

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block border border-hairline bg-surface rounded-md transition-colors hover:border-accent"
    >
      <div className="aspect-square overflow-hidden border-b border-hairline bg-paper">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-widest text-graphite">
            no image
          </div>
        )}
      </div>
      <div className="p-4">
        {product.category && (
          <p className="font-mono text-[11px] uppercase tracking-widest text-graphite">
            {product.category.name}
          </p>
        )}
        <h3 className="mt-1 font-display text-base font-medium text-ink group-hover:text-accent">
          {product.title}
        </h3>
        <Price cents={product.priceCents} currency={product.currency} className="mt-2 block text-sm" />
      </div>
    </Link>
  );
}
```

`apps/web/app/_components/product-grid.tsx`:
```tsx
import type { Product } from '@repo/types';
import { ProductCard } from './product-card';

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p className="py-16 text-center text-graphite">No products match these filters.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <div key={p.id} className="bg-paper">
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter web test` green.

- [ ] **Step 5: Commit**
```bash
git add apps/web/app/_components/product-card.tsx apps/web/app/_components/product-grid.tsx apps/web/app/_components/product-card.test.tsx
git commit -m "feat(web): ProductCard and ProductGrid"
```

---

### Task 5: Catalog page `/products` (RSC) + controls + pagination

**Files:**
- Create: `apps/web/app/products/page.tsx`, `apps/web/app/_components/catalog-controls.tsx`, `apps/web/app/_components/pagination.tsx`
- Test: `apps/web/app/_components/catalog-controls.test.tsx`

**Interfaces:**
- Consumes: `parseCatalogParams`, `catalogHref`; `listProducts`, `listCategories` (api-client); `ProductGrid`.
- `CatalogControls({ categories, current })` (client) → search box, category select, sort select; pushes updated searchParams via `useRouter`.
- `Pagination({ page, limit, total })` → prev/next links (via `catalogHref`) + `Page X / Y` in mono.

- [ ] **Step 1: Failing test (client control)**

`apps/web/app/_components/catalog-controls.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams() }));

import { CatalogControls } from './catalog-controls';

describe('CatalogControls', () => {
  it('renders category options and the sort control', () => {
    render(
      <CatalogControls
        categories={[{ id: 'c1', name: 'Audio', slug: 'audio' }]}
        current={{ page: 1, limit: 20, sort: 'newest' } as never}
      />,
    );
    expect(screen.getByRole('option', { name: 'Audio' })).toBeInTheDocument();
    expect(screen.getByLabelText(/sort/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter web test` FAIL.

- [ ] **Step 3: Implement controls + pagination + page**

`apps/web/app/_components/catalog-controls.tsx`:
```tsx
'use client';

import { useRouter } from 'next/navigation';
import type { Category, ProductListQuery } from '@repo/types';

export function CatalogControls({
  categories,
  current,
}: {
  categories: Category[];
  current: ProductListQuery;
}) {
  const router = useRouter();

  function update(patch: Partial<Record<string, string>>) {
    const params = new URLSearchParams();
    const merged = { category: current.category, q: current.q, sort: current.sort, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    router.push(params.toString() ? `/products?${params}` : '/products');
  }

  return (
    <div className="flex flex-wrap items-end gap-4 border-b border-hairline pb-4">
      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-graphite">
        Search
        <input
          type="search"
          defaultValue={current.q ?? ''}
          onBlur={(e) => update({ q: e.target.value })}
          className="w-48 border border-hairline bg-surface px-2 py-1 font-body text-sm text-ink rounded-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-graphite">
        Category
        <select
          defaultValue={current.category ?? ''}
          onChange={(e) => update({ category: e.target.value })}
          className="border border-hairline bg-surface px-2 py-1 text-sm text-ink rounded-sm"
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-graphite">
        Sort
        <select
          defaultValue={current.sort}
          onChange={(e) => update({ sort: e.target.value })}
          className="border border-hairline bg-surface px-2 py-1 text-sm text-ink rounded-sm"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
        </select>
      </label>
    </div>
  );
}
```

`apps/web/app/_components/pagination.tsx`:
```tsx
import Link from 'next/link';
import { catalogHref } from '@/lib/catalog-params';
import type { ProductListQuery } from '@repo/types';

export function Pagination({
  current,
  total,
}: {
  current: ProductListQuery;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / current.limit));
  if (pages <= 1) return null;
  const link = (p: number) => catalogHref({ ...current, page: p });
  return (
    <nav className="flex items-center justify-between border-t border-hairline pt-4 font-mono text-sm">
      {current.page > 1 ? (
        <Link href={link(current.page - 1)} className="text-accent hover:underline">
          ← Prev
        </Link>
      ) : (
        <span className="text-hairline">← Prev</span>
      )}
      <span className="text-graphite">
        Page {current.page} / {pages}
      </span>
      {current.page < pages ? (
        <Link href={link(current.page + 1)} className="text-accent hover:underline">
          Next →
        </Link>
      ) : (
        <span className="text-hairline">Next →</span>
      )}
    </nav>
  );
}
```

`apps/web/app/products/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { listCategories, listProducts } from '@repo/api-client';
import { parseCatalogParams } from '@/lib/catalog-params';
import { ProductGrid } from '@/app/_components/product-grid';
import { CatalogControls } from '@/app/_components/catalog-controls';
import { Pagination } from '@/app/_components/pagination';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Catalog' };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseCatalogParams(await searchParams);
  const [{ items, total }, categories] = await Promise.all([
    listProducts(query),
    listCategories(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Catalog</h1>
      <p className="mt-1 font-mono text-sm text-graphite">{total} products</p>
      <div className="mt-6 space-y-6">
        <CatalogControls categories={categories} current={query} />
        <ProductGrid products={items} />
        <Pagination current={query} total={total} />
      </div>
    </main>
  );
}
```

> Note: `searchParams` is a Promise in Next 15 (await it). If the installed Next types treat it as a plain object, drop the `Promise<>` wrapper and the `await` — verify against the typecheck and match the installed API.

- [ ] **Step 4: Run tests + gates** — `pnpm --filter web test` green; `pnpm --filter web typecheck`; `pnpm --filter web lint`; `NODE_ENV=production pnpm --filter web build` (route `/products` listed, dynamic `ƒ`).

- [ ] **Step 5: Commit**
```bash
git add apps/web/app/products/page.tsx apps/web/app/_components/catalog-controls.tsx apps/web/app/_components/pagination.tsx apps/web/app/_components/catalog-controls.test.tsx
git commit -m "feat(web): catalog page with filters, sort and pagination"
```

---

### Task 6: Product detail `/products/[slug]` (RSC) + reviews

**Files:**
- Create: `apps/web/app/products/[slug]/page.tsx`, `apps/web/app/_components/review-list.tsx`

**Interfaces:**
- Consumes: `getProduct` (returns product + `rating`), `listReviews` (api-client); `Price`, `Rating` (@repo/ui); `formatCount`.
- `ReviewList({ reviews })` → list of review cards (title, rating stars, body, muted date). Empty state handled by caller.
- Page: `generateMetadata` from the product; `notFound()` when the product 404s (inactive/missing).

- [ ] **Step 1: Implement `ReviewList`**

`apps/web/app/_components/review-list.tsx`:
```tsx
export type ReviewItem = {
  productId: string;
  userId: string;
  rating: number;
  title: string;
  body: string;
};

export function ReviewList({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) {
    return <p className="text-graphite">No reviews yet. Be the first.</p>;
  }
  return (
    <ul className="divide-y divide-hairline border-y border-hairline">
      {reviews.map((r, i) => (
        <li key={i} className="py-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display font-medium text-ink">{r.title}</h4>
            <span aria-label={`${r.rating} out of 5`} className="text-accent">
              {'★'.repeat(r.rating)}
              <span className="text-hairline">{'★'.repeat(5 - r.rating)}</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-graphite">{r.body}</p>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Implement the page**

`apps/web/app/products/[slug]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, getProduct, listReviews } from '@repo/api-client';
import { Price, Rating } from '@repo/ui';
import { ReviewList } from '@/app/_components/review-list';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  try {
    const [product, reviews] = await Promise.all([getProduct(slug), listReviews(slug).catch(() => null)]);
    return { product, reviews };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: 'Not found' };
  return { title: data.product.title, description: data.product.description };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { product, reviews } = data;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square border border-hairline bg-surface">
          {product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-widest text-graphite">
              no image
            </div>
          )}
        </div>
        <div>
          {product.category && (
            <p className="font-mono text-xs uppercase tracking-widest text-graphite">
              {product.category.name}
            </p>
          )}
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">{product.title}</h1>
          <div className="mt-2">
            <Rating avg={product.rating.avg} count={product.rating.count} />
          </div>
          <Price
            cents={product.priceCents}
            currency={product.currency}
            className="mt-4 block text-xl"
          />
          <p className="mt-4 text-graphite">{product.description}</p>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-ink">Reviews</h2>
        <div className="mt-4">
          <ReviewList reviews={reviews?.items ?? []} />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Gates** — `pnpm --filter web typecheck`, `lint`, `NODE_ENV=production pnpm --filter web build` (route `/products/[slug]` dynamic).

- [ ] **Step 4: Commit**
```bash
git add "apps/web/app/products/[slug]/page.tsx" apps/web/app/_components/review-list.tsx
git commit -m "feat(web): product detail page with reviews and rating"
```

---

### Task 7: Site header + home page

**Files:**
- Create: `apps/web/app/_components/site-header.tsx`, `apps/web/app/_components/ruler.tsx`
- Modify: `apps/web/app/layout.tsx` (mount header + footer), `apps/web/app/page.tsx` (home)

**Interfaces:**
- `Ruler()` → `<div className="ruler" />` signature divider.
- `SiteHeader({ categories })` → wordmark (display), category nav links (`catalogHref`), a Catalog link. Server component (fetches categories itself or receives them).
- Home: hero stating the thesis ("Everyday tech, precisely chosen") + a featured product row (first ~8 from `listProducts`).

- [ ] **Step 1: Ruler + SiteHeader**

`apps/web/app/_components/ruler.tsx`:
```tsx
export function Ruler() {
  return <div className="ruler" aria-hidden />;
}
```

`apps/web/app/_components/site-header.tsx`:
```tsx
import Link from 'next/link';
import { listCategories } from '@repo/api-client';
import { catalogHref } from '@/lib/catalog-params';
import { Ruler } from './ruler';

export async function SiteHeader() {
  const categories = await listCategories().catch(() => []);
  return (
    <header className="bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight text-ink">
          Measured
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {categories.slice(0, 4).map((c) => (
            <Link key={c.id} href={catalogHref({ category: c.slug })} className="text-graphite hover:text-accent">
              {c.name}
            </Link>
          ))}
          <Link href="/products" className="font-medium text-ink hover:text-accent">
            Catalog
          </Link>
        </nav>
      </div>
      <Ruler />
    </header>
  );
}
```

- [ ] **Step 2: Mount in layout**

`apps/web/app/layout.tsx` — wrap children with header + footer (keep the font wiring from Task 1):
```tsx
      <body className="min-h-dvh bg-paper font-body text-ink antialiased">
        <Providers>
          <SiteHeader />
          {children}
          <footer className="mt-16 border-t border-hairline">
            <div className="mx-auto max-w-6xl px-4 py-8 font-mono text-xs uppercase tracking-widest text-graphite">
              Measured — a portfolio storefront
            </div>
          </footer>
        </Providers>
      </body>
```
(Add `import { SiteHeader } from './_components/site-header';`. `SiteHeader` is async — allowed inside the server layout.)

- [ ] **Step 3: Home page**

`apps/web/app/page.tsx`:
```tsx
import Link from 'next/link';
import { listProducts } from '@repo/api-client';
import { Button } from '@repo/ui';
import { ProductGrid } from './_components/product-grid';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { items } = await listProducts({ limit: 8 }).catch(() => ({ items: [] as never[] }));
  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-graphite">Everyday tech</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          Precisely chosen gear for the way you work.
        </h1>
        <div className="mt-6">
          <Link href="/products">
            <Button>Browse the catalog</Button>
          </Link>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="mb-4 font-display text-lg font-medium text-ink">Featured</h2>
        <ProductGrid products={items} />
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Gates** — typecheck, lint, `NODE_ENV=production pnpm --filter web build` (routes `/`, `/products`, `/products/[slug]`).

- [ ] **Step 5: Commit**
```bash
git add apps/web/app/_components/site-header.tsx apps/web/app/_components/ruler.tsx apps/web/app/layout.tsx apps/web/app/page.tsx
git commit -m "feat(web): site header, ruler signature, and home page"
```

---

### Task 8: Full pipeline + visual verification

**Files:** none (integration checkpoint); small style fixes only if the visual pass demands them.

- [ ] **Step 1: Workspace pipeline**

Run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, then `NODE_ENV=production pnpm build`. All green.

- [ ] **Step 2: Visual pass (seeded data required)**

Ensure the API + seed are up (`pnpm --filter api exec prisma migrate deploy && pnpm --filter api db:seed`), start the API (`pnpm --filter api start`) and the web dev server (`pnpm --filter web dev`), then load `/`, `/products`, `/products/wireless-headphones` and confirm the Measured identity: paper background, Space Grotesk headings, mono prices/SKUs, cobalt CTAs/links, ruler under the header, responsive down to mobile. Use the `verify`/`run` skill to drive and screenshot. Fix only spacing/contrast/focus issues found; keep the signature restrained (ruler once in the header, mono only for data).

- [ ] **Step 3: Commit any visual fixes**
```bash
git add apps/web packages/ui
git commit -m "style(web): catalog visual polish"
```

---

## Definition of Done (M2)

- Home, `/products` (search + category + sort + pagination), and `/products/[slug]` (with rating + reviews) render from the API via RSC.
- The "Measured" identity is applied consistently (tokens, fonts, ruler, mono prices), responsive mobile-first, keyboard-focus visible, reduced-motion respected.
- `lint`, `typecheck`, `test` green across the workspace; `NODE_ENV=production pnpm build` green.
- No contract shapes redefined outside `@repo/types`; Playwright purchase-flow E2E remains deferred to M4.
