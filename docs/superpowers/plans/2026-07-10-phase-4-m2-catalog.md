# Phase 4 · M2 — Mobile Catalog + Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the Shop tab: a catalog screen (product list with search / category filter / pagination via Expo Router search params) and a product screen (`/shop/[slug]` with price, rating, and reviews), all over `@repo/api-client` — no API changes.

**Architecture:** Client-heavy Expo Router screens driven by TanStack Query over the public API (baseUrl from `lib/api.ts`; no auth needed for reads). Presentational RN components (`Price`, `Rating`, `ProductCard`) are unit-tested with RNTL; thin data hooks (`lib/catalog.ts`) and screens wire them, with screen tests mocking the hooks (same convention as web/admin). Reuses `@repo/types` contracts; `@repo/api-client` unchanged.

**Tech Stack:** Expo SDK 52 · Expo Router 4 · React 18.3 · TanStack Query 5 · Jest (`jest-expo`) + @testing-library/react-native · Playwright (Expo Web).

## Global Constraints

- **Commands in `fullstack-dev-1`.** Mobile: `pnpm --filter mobile test|typecheck|lint`; bundle `expo export --platform web`; E2E `CI=1 CORS_ORIGINS=http://localhost:8081 EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1 pnpm --filter mobile test:e2e`. Kill stale :3000/:8081 servers first (recurring env gotcha); after any docker-compose recreate re-run `playwright install --with-deps chromium`.
- Contracts from `@repo/types` **only** (`Product`, `ProductListQuery`, `Category`, `ProductRating`, review shapes). `@repo/api-client`/`@repo/types` consumed unchanged; `@repo/types` from dist (build if stale).
- Reads are **public** — hooks call the api-client with `{ baseUrl: API_BASE }` only (no `authed`). Money is integer cents; format with the RN `Price` component.
- **React isolation holds:** mobile stays on nested react@18.3.1 (Metro `resolveRequest` + jest `moduleNameMapper` already configured in M1). Don't add react/react-dom to `apps/mobile`'s deps.
- Screen files live under `app/`; **presentational components and tests must NOT** (Expo Router bundles every `app/**/*.tsx`). Components in `apps/mobile/components/`, tests in `apps/mobile/__tests__/`.
- jest.mock factories use `mock`-prefixed vars or in-factory `jest.fn()` (hoisting). Run a single test file by a name fragment that is a valid regex (avoid unescaped parens).
- Catalog params validated against `productListQuery` (mirror web's `parseCatalogParams`): invalid input → schema defaults, never a crash.
- Conventional Commits; no push/PR until the milestone is done and asked.

---

## File Structure

```
apps/mobile/
├─ components/
│  ├─ price.tsx            # NEW (presentational)                     (+test)
│  ├─ rating.tsx          # NEW (presentational)                     (+test)
│  └─ product-card.tsx    # NEW (presentational)                     (+test)
├─ lib/
│  ├─ catalog.ts          # NEW → useProducts/useProduct/useCategories/useReviews
│  └─ catalog-params.ts   # NEW → parseCatalogParams (mirror web)
├─ __tests__/
│  ├─ price.test.tsx  rating.test.tsx  product-card.test.tsx
│  ├─ catalog-screen.test.tsx
│  └─ product-screen.test.tsx
└─ app/(tabs)/shop/
   ├─ index.tsx           # UPDATE → catalog (search / category / pagination)
   └─ [slug].tsx          # NEW → product detail + reviews
apps/mobile/e2e/
└─ purchase.spec.ts       # UPDATE (rename smoke→browse) → catalog → product
```

Order: Price + Rating (T1) → ProductCard (T2) → hooks + params (T3) → catalog screen (T4) → product screen (T5) → pipeline + E2E (T6).

---

### Task 1: `Price` + `Rating` presentational components

**Files:** Create `apps/mobile/components/price.tsx`, `apps/mobile/components/rating.tsx`, `apps/mobile/__tests__/price.test.tsx`, `apps/mobile/__tests__/rating.test.tsx`.

**Interfaces (Produces):**
- `Price(props: { cents: number; currency: string; style?: TextStyle })`
- `Rating(props: { avg: number; count: number })`

- [ ] **Step 1: Failing tests**

`apps/mobile/__tests__/price.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';
import { Price } from '@/components/price';

describe('Price', () => {
  it('formats cents as a currency amount', () => {
    render(<Price cents={2500} currency="USD" />);
    expect(screen.getByText('$25.00')).toBeTruthy();
  });
  it('falls back to a prefixed code for unknown currencies', () => {
    render(<Price cents={1000} currency="JPY" />);
    expect(screen.getByText('JPY 10.00')).toBeTruthy();
  });
});
```

`apps/mobile/__tests__/rating.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';
import { Rating } from '@/components/rating';

describe('Rating', () => {
  it('shows the average and count when reviewed', () => {
    render(<Rating avg={4.5} count={12} />);
    expect(screen.getByText(/4\.5/)).toBeTruthy();
    expect(screen.getByText(/12/)).toBeTruthy();
  });
  it('shows an unrated state when there are no reviews', () => {
    render(<Rating avg={0} count={0} />);
    expect(screen.getByText(/no reviews/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter mobile test price` and `... test rating` → FAIL (modules missing).

- [ ] **Step 3: Implement**

`apps/mobile/components/price.tsx`:
```tsx
import { Text, type TextStyle } from 'react-native';

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };

export function Price({
  cents,
  currency,
  style,
}: {
  cents: number;
  currency: string;
  style?: TextStyle;
}) {
  const symbol = SYMBOLS[currency];
  const amount = (cents / 100).toFixed(2);
  return (
    <Text style={[{ fontVariant: ['tabular-nums'], color: '#17171B' }, style]}>
      {symbol ? `${symbol}${amount}` : `${currency} ${amount}`}
    </Text>
  );
}
```

`apps/mobile/components/rating.tsx`:
```tsx
import { Text } from 'react-native';

export function Rating({ avg, count }: { avg: number; count: number }) {
  if (count === 0) {
    return <Text style={{ color: '#70707A', fontSize: 13 }}>No reviews yet</Text>;
  }
  return (
    <Text style={{ color: '#70707A', fontSize: 13 }}>
      ★ {avg.toFixed(1)} ({count})
    </Text>
  );
}
```

- [ ] **Step 4: Run, verify pass** — both files → 2 pass each.

- [ ] **Step 5: Commit** — `git add apps/mobile/components/price.tsx apps/mobile/components/rating.tsx apps/mobile/__tests__/price.test.tsx apps/mobile/__tests__/rating.test.tsx && git commit -m "feat(mobile): Price and Rating components"`

---

### Task 2: `ProductCard` presentational component

**Files:** Create `apps/mobile/components/product-card.tsx`, `apps/mobile/__tests__/product-card.test.tsx`.

**Interfaces (Produces):** `ProductCard(props: { product: Product; onPress: () => void })` — title, category name, `Price`; whole card is pressable.

- [ ] **Step 1: Failing test** — `apps/mobile/__tests__/product-card.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product } from '@repo/types';
import { ProductCard } from '@/components/product-card';

const product: Product = {
  id: 'p1',
  title: 'USB-C Cable',
  slug: 'usb-c-cable',
  description: 'A cable',
  priceCents: 2500,
  currency: 'USD',
  stock: 10,
  images: [],
  isActive: true,
  categoryId: 'c1',
  category: { id: 'c1', name: 'Cables', slug: 'cables' },
  createdAt: new Date('2026-01-01'),
};

describe('ProductCard', () => {
  it('shows the title, category, and price and fires onPress', () => {
    const onPress = jest.fn();
    render(<ProductCard product={product} onPress={onPress} />);
    expect(screen.getByText('USB-C Cable')).toBeTruthy();
    expect(screen.getByText('Cables')).toBeTruthy();
    expect(screen.getByText('$25.00')).toBeTruthy();
    fireEvent.press(screen.getByText('USB-C Cable'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter mobile test product-card` → FAIL.

- [ ] **Step 3: Implement** — `apps/mobile/components/product-card.tsx`:
```tsx
import { Pressable, Text, View } from 'react-native';
import type { Product } from '@repo/types';
import { Price } from './price';

export function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: '#DAD8D1',
        borderRadius: 6,
        padding: 16,
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#17171B' }}>{product.title}</Text>
      {product.category ? (
        <Text style={{ fontSize: 12, color: '#70707A', marginTop: 2 }}>{product.category.name}</Text>
      ) : null}
      <View style={{ marginTop: 8 }}>
        <Price cents={product.priceCents} currency={product.currency} />
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run, verify pass** — → 1 pass.

- [ ] **Step 5: Commit** — `git add apps/mobile/components/product-card.tsx apps/mobile/__tests__/product-card.test.tsx && git commit -m "feat(mobile): product card"`

---

### Task 3: catalog hooks + params

**Files:** Create `apps/mobile/lib/catalog.ts`, `apps/mobile/lib/catalog-params.ts`.

**Interfaces (Produces):**
- `parseCatalogParams(sp: Record<string, string | string[] | undefined>): ProductListQuery`
- `useProducts(query: Partial<ProductListQuery>)`, `useProduct(slug: string)`, `useCategories()`, `useReviews(productId: string)` — TanStack Query results.

- [ ] **Step 1: catalog-params.ts** (mirror web):
```ts
import { productListQuery, type ProductListQuery } from '@repo/types';

type RawParams = Record<string, string | string[] | undefined>;

export function parseCatalogParams(sp: RawParams): ProductListQuery {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') flat[k] = v[0];
  }
  const parsed = productListQuery.safeParse(flat);
  return parsed.success ? parsed.data : productListQuery.parse({});
}
```

- [ ] **Step 2: catalog.ts**:
```ts
import { useQuery } from '@tanstack/react-query';
import {
  getProduct,
  listCategories,
  listProducts,
  listReviews,
  type ProductDetail,
  type ReviewList,
} from '@repo/api-client';
import type { Category, Paginated, Product, ProductListQuery } from '@repo/types';
import { API_BASE } from './api';

const opts = { baseUrl: API_BASE };

export function useProducts(query: Partial<ProductListQuery>) {
  return useQuery<Paginated<Product>>({
    queryKey: ['products', query],
    queryFn: () => listProducts(query, opts),
  });
}

export function useProduct(slug: string) {
  return useQuery<ProductDetail>({
    queryKey: ['product', slug],
    queryFn: () => getProduct(slug, opts),
    enabled: Boolean(slug),
  });
}

export function useCategories() {
  return useQuery<Category[]>({ queryKey: ['categories'], queryFn: () => listCategories(opts) });
}

export function useReviews(productId: string) {
  return useQuery<ReviewList>({
    queryKey: ['reviews', productId],
    queryFn: () => listReviews(productId, {}, opts),
    enabled: Boolean(productId),
  });
}
```

- [ ] **Step 3: Verify** — `pnpm --filter mobile typecheck` clean (screens consume these next).

- [ ] **Step 4: Commit** — `git add apps/mobile/lib/catalog.ts apps/mobile/lib/catalog-params.ts && git commit -m "feat(mobile): catalog data hooks + param parsing"`

---

### Task 4: Shop catalog screen (search / category / pagination)

**Files:** Modify `apps/mobile/app/(tabs)/shop/index.tsx`; Test `apps/mobile/__tests__/catalog-screen.test.tsx`.

**Interfaces (Consumes):** `useProducts`/`useCategories` (T3), `ProductCard` (T2), `useLocalSearchParams`/`useRouter` (expo-router).

**Behaviour:** reads params via `useLocalSearchParams` → `parseCatalogParams`; a search `TextInput` sets `q`; category chips set `category` (slug); prev/next buttons page. Renders a `FlatList` of `ProductCard`, an empty state, a loading state. Tapping a card routes to `/shop/[slug]`.

- [ ] **Step 1: Failing test** — `apps/mobile/__tests__/catalog-screen.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product } from '@repo/types';

const mockSetParams = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: mockSetParams, push: mockPush }),
}));

const mockUseProducts = jest.fn();
const mockUseCategories = jest.fn();
jest.mock('@/lib/catalog', () => ({
  useProducts: (...a: unknown[]) => mockUseProducts(...a),
  useCategories: (...a: unknown[]) => mockUseCategories(...a),
}));

import ShopScreen from '@/app/(tabs)/shop/index';

const product: Product = {
  id: 'p1',
  title: 'USB-C Cable',
  slug: 'usb-c-cable',
  description: 'd',
  priceCents: 2500,
  currency: 'USD',
  stock: 5,
  images: [],
  isActive: true,
  categoryId: 'c1',
  category: { id: 'c1', name: 'Cables', slug: 'cables' },
  createdAt: new Date('2026-01-01'),
};

beforeEach(() => {
  mockParams = {};
  mockSetParams.mockReset();
  mockPush.mockReset();
  mockUseCategories.mockReturnValue({ data: [{ id: 'c1', name: 'Cables', slug: 'cables' }] });
  mockUseProducts.mockReturnValue({
    data: { items: [product], total: 1, page: 1, limit: 20 },
    isLoading: false,
    isError: false,
  });
});

it('lists products and navigates to a product on tap', () => {
  render(<ShopScreen />);
  expect(screen.getByText('USB-C Cable')).toBeTruthy();
  fireEvent.press(screen.getByText('USB-C Cable'));
  expect(mockPush).toHaveBeenCalledWith('/shop/usb-c-cable');
});

it('shows an empty state when there are no products', () => {
  mockUseProducts.mockReturnValue({
    data: { items: [], total: 0, page: 1, limit: 20 },
    isLoading: false,
    isError: false,
  });
  render(<ShopScreen />);
  expect(screen.getByText(/no products/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter mobile test catalog-screen` → FAIL.

- [ ] **Step 3: Implement** — `apps/mobile/app/(tabs)/shop/index.tsx`:
```tsx
import { useState } from 'react';
import { FlatList, Text, TextInput, View, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { parseCatalogParams } from '@/lib/catalog-params';
import { useCategories, useProducts } from '@/lib/catalog';
import { ProductCard } from '@/components/product-card';

export default function ShopScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const query = parseCatalogParams(params as Record<string, string | string[] | undefined>);
  const products = useProducts(query);
  const categories = useCategories();
  const [term, setTerm] = useState(query.q ?? '');

  const items = products.data?.items ?? [];
  const total = products.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / query.limit));

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TextInput
        accessibilityLabel="Search products"
        placeholder="Search products"
        value={term}
        onChangeText={setTerm}
        onSubmitEditing={() => router.setParams({ q: term || undefined, page: '1' })}
        style={{
          borderWidth: 1,
          borderColor: '#DAD8D1',
          borderRadius: 6,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 12,
        }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {(categories.data ?? []).map((c) => (
          <Pressable
            key={c.id}
            onPress={() =>
              router.setParams({
                category: query.category === c.slug ? undefined : c.slug,
                page: '1',
              })
            }
            style={{
              borderWidth: 1,
              borderColor: query.category === c.slug ? '#2440F0' : '#DAD8D1',
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: query.category === c.slug ? '#2440F0' : '#70707A' }}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {products.isLoading ? (
        <ActivityIndicator />
      ) : products.isError ? (
        <Text style={{ color: '#2440F0' }}>Failed to load products.</Text>
      ) : items.length === 0 ? (
        <Text style={{ color: '#70707A' }}>No products found.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => router.push(`/shop/${item.slug}`)} />
          )}
          ListFooterComponent={
            lastPage > 1 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
                <Pressable
                  disabled={query.page <= 1}
                  onPress={() => router.setParams({ page: String(query.page - 1) })}
                >
                  <Text style={{ color: query.page <= 1 ? '#B0B0B8' : '#2440F0' }}>Previous</Text>
                </Pressable>
                <Text style={{ color: '#70707A' }}>
                  Page {query.page} of {lastPage}
                </Text>
                <Pressable
                  disabled={query.page >= lastPage}
                  onPress={() => router.setParams({ page: String(query.page + 1) })}
                >
                  <Text style={{ color: query.page >= lastPage ? '#B0B0B8' : '#2440F0' }}>Next</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
```

- [ ] **Step 4: Run, verify pass + typecheck** — `pnpm --filter mobile test catalog-screen` → 2 pass; `pnpm --filter mobile typecheck` clean.

- [ ] **Step 5: Commit** — `git add "apps/mobile/app/(tabs)/shop/index.tsx" apps/mobile/__tests__/catalog-screen.test.tsx && git commit -m "feat(mobile): catalog screen with search, category filter, pagination"`

---

### Task 5: Product detail screen (`/shop/[slug]`)

**Files:** Create `apps/mobile/app/(tabs)/shop/[slug].tsx`, `apps/mobile/__tests__/product-screen.test.tsx`.

**Interfaces (Consumes):** `useProduct`/`useReviews` (T3), `Price`/`Rating` (T1), `useLocalSearchParams` (expo-router).

**Behaviour:** reads `slug` param → `useProduct(slug)`; loading/error/not-found states; renders title, `Price`, `Rating` (from `product.rating`), description, and a reviews list from `useReviews(product.id)`.

- [ ] **Step 1: Failing test** — `apps/mobile/__tests__/product-screen.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';
import type { ProductDetail, ReviewList } from '@repo/api-client';

let mockParams: Record<string, string> = { slug: 'usb-c-cable' };
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));

const mockUseProduct = jest.fn();
const mockUseReviews = jest.fn();
jest.mock('@/lib/catalog', () => ({
  useProduct: (...a: unknown[]) => mockUseProduct(...a),
  useReviews: (...a: unknown[]) => mockUseReviews(...a),
}));

import ProductScreen from '@/app/(tabs)/shop/[slug]';

const product: ProductDetail = {
  id: 'p1',
  title: 'USB-C Cable',
  slug: 'usb-c-cable',
  description: 'A braided cable',
  priceCents: 2500,
  currency: 'USD',
  stock: 5,
  images: [],
  isActive: true,
  categoryId: 'c1',
  createdAt: new Date('2026-01-01'),
  rating: { avg: 4.5, count: 2 },
} as ProductDetail;

const reviews: ReviewList = {
  items: [{ productId: 'p1', userId: 'u1', rating: 5, title: 'Great', body: 'Works well' }],
  total: 1,
  page: 1,
  limit: 20,
  rating: { avg: 4.5, count: 2 },
};

beforeEach(() => {
  mockParams = { slug: 'usb-c-cable' };
  mockUseProduct.mockReturnValue({ data: product, isLoading: false, isError: false });
  mockUseReviews.mockReturnValue({ data: reviews, isLoading: false, isError: false });
});

it('renders product details, price, rating, and reviews', () => {
  render(<ProductScreen />);
  expect(screen.getByText('USB-C Cable')).toBeTruthy();
  expect(screen.getByText('$25.00')).toBeTruthy();
  expect(screen.getByText(/4\.5/)).toBeTruthy();
  expect(screen.getByText('A braided cable')).toBeTruthy();
  expect(screen.getByText('Great')).toBeTruthy();
});

it('shows a not-found state when the product is missing', () => {
  mockUseProduct.mockReturnValue({ data: undefined, isLoading: false, isError: true });
  render(<ProductScreen />);
  expect(screen.getByText(/not found/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter mobile test product-screen` → FAIL.

- [ ] **Step 3: Implement** — `apps/mobile/app/(tabs)/shop/[slug].tsx`:
```tsx
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Price } from '@/components/price';
import { Rating } from '@/components/rating';
import { useProduct, useReviews } from '@/lib/catalog';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const product = useProduct(slug);
  const reviews = useReviews(product.data?.id ?? '');

  if (product.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (product.isError || !product.data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#70707A' }}>Product not found.</Text>
      </View>
    );
  }
  const p = product.data;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#17171B' }}>{p.title}</Text>
      <View style={{ marginTop: 8 }}>
        <Price cents={p.priceCents} currency={p.currency} style={{ fontSize: 18 }} />
      </View>
      <View style={{ marginTop: 4 }}>
        <Rating avg={p.rating.avg} count={p.rating.count} />
      </View>
      <Text style={{ marginTop: 16, color: '#17171B', lineHeight: 20 }}>{p.description}</Text>

      <Text style={{ marginTop: 24, fontSize: 16, fontWeight: '600', color: '#17171B' }}>
        Reviews
      </Text>
      {(reviews.data?.items ?? []).length === 0 ? (
        <Text style={{ marginTop: 8, color: '#70707A' }}>No reviews yet.</Text>
      ) : (
        (reviews.data?.items ?? []).map((r, i) => (
          <View key={i} style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#DAD8D1', paddingTop: 12 }}>
            <Text style={{ fontWeight: '600', color: '#17171B' }}>
              {r.title} · {r.rating}★
            </Text>
            <Text style={{ marginTop: 2, color: '#70707A' }}>{r.body}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
```

- [ ] **Step 4: Run, verify pass + typecheck** — `pnpm --filter mobile test product-screen` → 2 pass; `pnpm --filter mobile typecheck` clean.

- [ ] **Step 5: Commit** — `git add "apps/mobile/app/(tabs)/shop/[slug].tsx" apps/mobile/__tests__/product-screen.test.tsx && git commit -m "feat(mobile): product detail screen with reviews"`

---

### Task 6: Pipeline + browse E2E

**Files:** Rename/rewrite `apps/mobile/e2e/smoke.spec.ts` → `apps/mobile/e2e/browse.spec.ts`.

- [ ] **Step 1: Browse E2E** — replace the smoke spec with a catalog→product walk. `apps/mobile/e2e/browse.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('browses the catalog and opens a product', async ({ page }) => {
  await page.goto('/shop');
  // Seeded, known in-stock product.
  const cable = page.getByText('USB-C Cable').first();
  await expect(cable).toBeVisible();
  await cable.click();
  await expect(page).toHaveURL(/\/shop\/usb-c-cable/);
  await expect(page.getByText(/reviews/i).first()).toBeVisible();
});
```
Delete `apps/mobile/e2e/smoke.spec.ts`.

- [ ] **Step 2: Run E2E (in-container)** — kill stale :3000/:8081 first:
```
docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; CI=1 CORS_ORIGINS=http://localhost:8081 EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1 pnpm --filter mobile test:e2e 2>&1 | tail -8"
```
Expected: 1 passed. (If the seeded `usb-c-cable` isn't on page 1 of the catalog, the E2E navigates via `page.goto('/shop/usb-c-cable')` directly instead — adjust only if needed.)

- [ ] **Step 3: Workspace pipeline** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `NODE_ENV=production pnpm build` green; `pnpm --filter mobile exec expo export --platform web --output-dir /tmp/mw` succeeds; `pnpm install --frozen-lockfile` consistent (no new deps).
- [ ] **Step 4: Commit** — `git add apps/mobile/e2e && git commit -m "test(mobile): browse catalog → product E2E"`

---

## Definition of Done (M2)

- Shop tab lists products with working search, category filter, and pagination; tapping a product opens `/shop/[slug]` showing price, rating, description, and reviews.
- RNTL unit tests cover Price/Rating/ProductCard and both screens (hooks mocked); the Expo Web browse E2E (catalog → product) passes.
- `lint`/`typecheck`/`test` green across the workspace; mobile bundles for web; frozen-lockfile consistent. No changes to `@repo/*` contracts or the API.
- Cart/checkout (M3) and orders (M4) still to come.

---

## Self-Review

- **Spec coverage:** §5 M2 row (Shop catalog with search/category/pagination via search params; product screen with rating + reviews) → T1–T5; §8.2 E2E (catalog → product on Expo Web) → T6. §6 (public reads via TanStack Query over `lib/api.ts` baseUrl) → T3.
- **Placeholder scan:** none — full code or exact commands throughout.
- **Type consistency:** `useProducts` returns `Paginated<Product>` (`.items`/`.total`) consumed by the catalog screen; `useProduct` → `ProductDetail` (has `rating`) consumed by the product screen; `useReviews` → `ReviewList` (`.items` with `title`/`body`/`rating`). `ProductCard` takes `{product, onPress}`; `Price` `{cents, currency, style?}`; `Rating` `{avg, count}`. `parseCatalogParams` returns `ProductListQuery` (has `page`/`limit`/`q`/`category`). Screens import from `@/app/(tabs)/shop/...` in tests (jest `@/` mapper).
- **React/bundle isolation:** no react deps added; components in `components/`, tests in `__tests__/` (not under `app/`) so Expo Router won't bundle them; screen tests mock `expo-router` + `@/lib/catalog`.
- **YAGNI:** no infinite scroll (explicit prev/next), no image gallery (RN Image deferred), no review submission (M3+/out of scope) — catalog + read-only product only.
```
