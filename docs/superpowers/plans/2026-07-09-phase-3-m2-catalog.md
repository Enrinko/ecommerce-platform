# Phase 3 · M2 — Admin Catalog (products + categories) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin a working catalog: a products table (all statuses) with create / edit / deactivate / delete, and a categories table with create / rename / delete — forms on react-hook-form + zod, data via TanStack Query over the authed client.

**Architecture:** Client-heavy admin (Phase 3 M1). Heavy logic lives in **presentational** components (`ProductForm`, `ProductsTable`, `CategoriesManager`) that take data + callbacks as props and are unit-tested with RTL; thin page components wire TanStack Query hooks (`lib/catalog.ts`) to them. A small API extension adds ADMIN-only reads that return **all** products (incl. inactive) so the admin can see and edit deactivated items — the public `GET /products` filters `isActive:true`.

**Tech Stack:** NestJS (Prisma) · Next 15 App Router · React 19 · `@repo/api-client`/`@repo/ui`/`@repo/types` · TanStack Query 5 · react-hook-form + `@hookform/resolvers/zod` · Vitest + @testing-library/react · supertest (api e2e).

## Global Constraints

- **Measured** design system from `@repo/ui`, **dense** admin layout (compact tables, tight forms, small radii); Space Grotesk / Inter / IBM Plex Mono; tokens paper/surface/ink/graphite/hairline + `accent` cobalt.
- Contracts come from `@repo/types` **only** — reuse `product`, `createProductInput`, `updateProductInput`, `category`, `createCategoryInput`, `updateCategoryInput`, `pageQuery`, `Paginated`, `currency` (`'USD'|'EUR'|'GBP'`). Do **not** redefine shapes. No new types are needed in M2.
- **Money is integer cents** end to end. Product form inputs `priceCents` directly (labelled "Price, cents"); no float dollars conversion. **Images** are a `string[]`; the form edits them as a newline-separated URL list.
- **"Remove" semantics:** the primary destructive action is **Deactivate** (`PATCH /products/:id { isActive:false }`), because `OrderItem.product`/`CartItem.product` are `Restrict` FKs — hard-deleting a referenced product fails. A hard **Delete** is offered too and its **409** is surfaced as a friendly message ("referenced by orders — deactivate instead"). Category delete likewise surfaces **409** ("category still has products").
- New API reads `GET /admin/products` (paginated, all statuses) and `GET /admin/products/:id` (any status) are behind `JwtAuthGuard + RolesGuard @Roles('ADMIN')`.
- Testing convention (matches `apps/web`): behavioural tests target **presentational** components + api-client + api e2e; thin hooks (`lib/catalog.ts`, like web's `lib/cart.ts`) and thin page wrappers are covered by `typecheck`/`build` and the M4 Playwright flow, not dedicated unit tests.
- Commands run in `fullstack-dev-1` (`docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm ..."`). Local admin production build uses `NODE_ENV=production pnpm --filter admin build`; `lint`/`typecheck`/`test` run without it. API e2e: `pnpm --filter api test:e2e`. Conventional Commits; no push/PR until the milestone is done and asked.
- `@repo/api-client` is edited (source) — apps consume it via `transpilePackages`, no rebuild needed; but `pnpm --filter @repo/api-client typecheck`/`test` must stay green.

---

## File Structure

```
apps/api/src/products/
├─ admin-products.controller.ts   # NEW → GET /admin/products, GET /admin/products/:id (ADMIN)
├─ products.service.ts            # UPDATE → listAllForAdmin(pageQuery), getById(id)
└─ products.module.ts             # UPDATE → register AdminProductsController
apps/api/test/
└─ admin-products.e2e-spec.ts     # NEW → role/access + inactive visible + getById 404

packages/api-client/src/
├─ admin.ts                       # UPDATE → listAdminProducts(query), getAdminProduct(id)   (+test)
└─ admin.test.ts                  # UPDATE

apps/admin/
├─ lib/
│  └─ catalog.ts                  # NEW → TanStack Query hooks + mutations (thin)
└─ app/
   ├─ _components/
   │  ├─ product-form.tsx         # NEW (presentational, rhf+zod)                              (+test)
   │  ├─ products-table.tsx       # NEW (presentational)                                       (+test)
   │  └─ categories-manager.tsx   # NEW (presentational, rhf+zod)                               (+test)
   ├─ products/
   │  ├─ page.tsx                 # NEW → table + New link (wires hooks)
   │  ├─ new/page.tsx             # NEW → create
   │  └─ [id]/edit/page.tsx       # NEW → edit (loads via getAdminProduct)
   └─ categories/page.tsx         # NEW → manager (wires hooks)
```

Order: API reads (T1) → api-client (T2) → ProductForm (T3) → ProductsTable (T4) → CategoriesManager (T5) → hooks + pages wiring (T6) → pipeline + live check (T7).

---

### Task 1: API — ADMIN product reads (`GET /admin/products`, `GET /admin/products/:id`)

**Files:** Create `apps/api/src/products/admin-products.controller.ts`; Modify `apps/api/src/products/products.service.ts`, `apps/api/src/products/products.module.ts`; Test `apps/api/test/admin-products.e2e-spec.ts`.

**Interfaces (Produces):**
- `ProductsService.listAllForAdmin(query: PageQuery): Promise<Paginated<Product>>` — all statuses, newest first, `include category`.
- `ProductsService.getById(id: string): Promise<Product>` — any status; 404 if missing.
- Routes `GET /api/v1/admin/products` and `GET /api/v1/admin/products/:id`, ADMIN-guarded.

- [ ] **Step 1: Failing e2e**

`apps/api/test/admin-products.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Admin product reads (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let customerToken: string;
  let inactiveId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    adminToken = admin.body.accessToken;
    const cust = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `pcust_${Date.now()}@example.com`, password: 'secret123' });
    customerToken = cust.body.accessToken;

    const cat = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'AdminRead', slug: `adminread-${Date.now()}` });
    const created = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Deactivated Item',
        slug: `deact-${Date.now()}`,
        description: 'hidden from storefront',
        priceCents: 1234,
        isActive: false,
        categoryId: cat.body.id,
      })
      .expect(201);
    inactiveId = created.body.id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('rejects anonymous (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/products').expect(401);
  });

  it('rejects a customer (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('lists all products for an admin, including inactive ones', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/products?limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({ total: expect.any(Number), page: 1, limit: 100 }),
    );
    const ids = (res.body.items as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain(inactiveId);
  });

  it('reads a single inactive product by id for an admin', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/products/${inactiveId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.isActive).toBe(false);
  });

  it('returns 404 (not 500) for a missing product id', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/products/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter api test:e2e -- admin-products"` → FAIL (routes 404, guard missing).

- [ ] **Step 3: Implement service methods**

In `apps/api/src/products/products.service.ts`, add `PageQuery` to the type import from `@repo/types`, then add two methods to the class (after `getBySlug`):
```ts
  async listAllForAdmin(query: PageQuery): Promise<Paginated<Product>> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        ...withCategory,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count(),
    ]);
    return { items: items as unknown as Product[], total, page: query.page, limit: query.limit };
  }

  async getById(id: string): Promise<Product> {
    const found = await this.prisma.product.findUnique({ where: { id }, ...withCategory });
    if (!found) throw new NotFoundException(`Product ${id} not found`);
    return found as unknown as Product;
  }
```

- [ ] **Step 4: Implement the controller**

`apps/api/src/products/admin-products.controller.ts`:
```ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { pageQuery } from '@repo/types';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  listAll(@Query() query: unknown) {
    return this.products.listAllForAdmin(pageQuery.parse(query));
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.products.getById(id);
  }
}
```

Register it in `apps/api/src/products/products.module.ts`:
```ts
import { AdminProductsController } from './admin-products.controller';
// ...
  controllers: [ProductsController, AdminProductsController],
```

- [ ] **Step 5: Run, verify pass** — `pnpm --filter api test:e2e -- admin-products` → 5 pass. Then full `pnpm --filter api test:e2e` stays green.

- [ ] **Step 6: Commit** — `git add apps/api && git commit -m "feat(api): admin product reads incl. inactive (GET /admin/products[/:id])"`

---

### Task 2: `@repo/api-client` — `listAdminProducts` + `getAdminProduct`

**Files:** Modify `packages/api-client/src/admin.ts`; Test `packages/api-client/src/admin.test.ts`.

**Interfaces (Produces):**
- `listAdminProducts(query: Partial<PageQuery> = {}, opts?): Promise<Paginated<Product>>` → `GET /admin/products{?page,limit}`
- `getAdminProduct(id: string, opts?): Promise<Product>` → `GET /admin/products/:id`

- [ ] **Step 1: Failing test** — append to `packages/api-client/src/admin.test.ts` (inside the existing `describe`, and add the imports to the top `import { ... } from './index';` line):
```ts
  it('reads the admin product list and a single product', async () => {
    const spy = capture(200, { items: [], total: 0, page: 3, limit: 50 });
    await listAdminProducts({ page: 3, limit: 50 }, { baseUrl: 'http://api', accessToken: 'tok' });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api/admin/products?page=3&limit=50');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok');

    const spy2 = capture(200, { id: 'p1', isActive: false });
    await getAdminProduct('p1', { baseUrl: 'http://api' });
    expect(spy2.mock.calls[0][0]).toBe('http://api/admin/products/p1');
  });
```
Update the import line to: `import { createProduct, getAdminProduct, listAdminProducts, listAllOrders, updateOrderStatus } from './index';`

- [ ] **Step 2: Run, verify fail** — `pnpm --filter @repo/api-client test` → FAIL (exports missing).

- [ ] **Step 3: Implement** — in `packages/api-client/src/admin.ts`, extend the type import to include `Paginated` and `PageQuery`, and add:
```ts
export function listAdminProducts(
  query: Partial<PageQuery> = {},
  opts?: RequestOptions,
): Promise<Paginated<Product>> {
  return apiFetch<Paginated<Product>>(`/admin/products${toQuery(query)}`, opts);
}
export function getAdminProduct(id: string, opts?: RequestOptions): Promise<Product> {
  return apiFetch<Product>(`/admin/products/${id}`, opts);
}
```
(The `import type { ... } from '@repo/types';` block gains `PageQuery` and `Paginated`; `Product` is already imported.)

- [ ] **Step 4: Run, verify pass + typecheck** — `pnpm --filter @repo/api-client test` green (8 → 9 tests); `pnpm --filter @repo/api-client typecheck` clean.

- [ ] **Step 5: Commit** — `git add packages/api-client && git commit -m "feat(api-client): listAdminProducts + getAdminProduct"`

---

### Task 3: `ProductForm` (presentational, rhf + zod)

**Files:** Create `apps/admin/app/_components/product-form.tsx`, `apps/admin/app/_components/product-form.test.tsx`.

**Interfaces (Produces):**
```ts
type ProductFormProps = {
  categories: Category[];
  defaultValues?: Partial<CreateProductInput>;
  submitting?: boolean;
  submitLabel?: string;
  error?: string | null;
  onSubmit: (values: CreateProductInput) => void;
};
export function ProductForm(props: ProductFormProps): JSX.Element;
```
Validates with `zodResolver(createProductInput)`. `priceCents`/`stock` are numeric inputs (`valueAsNumber`); `images` is a newline textarea transformed to `string[]` on submit; `categoryId` is a `<select>` of `categories`; `currency` is a `<select>` of `USD/EUR/GBP`; `isActive` is a checkbox.

- [ ] **Step 1: Failing test**

`apps/admin/app/_components/product-form.test.tsx`:
```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Category } from '@repo/types';
import { ProductForm } from './product-form';

const categories: Category[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Cables', slug: 'cables' },
];

describe('ProductForm', () => {
  it('blocks submit and shows an error when required fields are empty', async () => {
    const onSubmit = vi.fn();
    render(<ProductForm categories={categories} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.getByText(/required|at least 1/i)).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits parsed values (cents number + images array)', async () => {
    const onSubmit = vi.fn();
    render(<ProductForm categories={categories} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'USB-C Cable' } });
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'usb-c-cable' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A cable' } });
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '2500' } });
    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { value: '11111111-1111-1111-1111-111111111111' },
    });
    fireEvent.change(screen.getByLabelText(/image/i), {
      target: { value: 'https://x/img1.png\n\nhttps://x/img2.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'USB-C Cable',
        slug: 'usb-c-cable',
        priceCents: 2500,
        currency: 'USD',
        categoryId: '11111111-1111-1111-1111-111111111111',
        images: ['https://x/img1.png', 'https://x/img2.png'],
      }),
    );
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter admin test product-form` → FAIL (module missing).

- [ ] **Step 3: Implement**

`apps/admin/app/_components/product-form.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProductInput, currency as currencyEnum, type Category, type CreateProductInput } from '@repo/types';
import { Button } from '@repo/ui';

const field = 'mt-1 w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-ink';
const labelText = 'block text-sm text-graphite';

export function ProductForm({
  categories,
  defaultValues,
  submitting,
  submitLabel = 'Save product',
  error,
  onSubmit,
}: {
  categories: Category[];
  defaultValues?: Partial<CreateProductInput>;
  submitting?: boolean;
  submitLabel?: string;
  error?: string | null;
  onSubmit: (values: CreateProductInput) => void;
}) {
  const [imagesText, setImagesText] = useState((defaultValues?.images ?? []).join('\n'));
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductInput),
    defaultValues: {
      currency: 'USD',
      stock: 0,
      images: [],
      isActive: true,
      ...defaultValues,
    },
  });

  const submit = handleSubmit((values) =>
    onSubmit({
      ...values,
      images: imagesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    }),
  );

  return (
    <form onSubmit={submit} className="mt-6 max-w-2xl space-y-4">
      <label className={labelText}>
        Title
        <input {...register('title')} className={field} />
        {errors.title && <span className="text-sm text-accent">{errors.title.message}</span>}
      </label>
      <label className={labelText}>
        Slug
        <input {...register('slug')} className={field} />
        {errors.slug && <span className="text-sm text-accent">{errors.slug.message}</span>}
      </label>
      <label className={labelText}>
        Description
        <textarea rows={3} {...register('description')} className={field} />
        {errors.description && (
          <span className="text-sm text-accent">{errors.description.message}</span>
        )}
      </label>
      <div className="grid grid-cols-3 gap-4">
        <label className={labelText}>
          Price, cents
          <input
            type="number"
            {...register('priceCents', { valueAsNumber: true })}
            className={field}
          />
          {errors.priceCents && (
            <span className="text-sm text-accent">{errors.priceCents.message}</span>
          )}
        </label>
        <label className={labelText}>
          Currency
          <select {...register('currency')} className={field}>
            {currencyEnum.options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={labelText}>
          Stock
          <input type="number" {...register('stock', { valueAsNumber: true })} className={field} />
          {errors.stock && <span className="text-sm text-accent">{errors.stock.message}</span>}
        </label>
      </div>
      <label className={labelText}>
        Category
        <select {...register('categoryId')} className={field} defaultValue={defaultValues?.categoryId ?? ''}>
          <option value="" disabled>
            Select a category…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <span className="text-sm text-accent">A category is required.</span>
        )}
      </label>
      <label className={labelText}>
        Image URLs (one per line)
        <textarea
          rows={3}
          value={imagesText}
          onChange={(e) => setImagesText(e.target.value)}
          className={`${field} font-mono text-xs`}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-graphite">
        <input type="checkbox" {...register('isActive')} />
        Active (visible on the storefront)
      </label>
      {error && <p className="text-sm text-accent">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter admin test product-form` → 2 pass.

- [ ] **Step 5: Commit** — `git add apps/admin/app/_components/product-form.tsx apps/admin/app/_components/product-form.test.tsx && git commit -m "feat(admin): product form (rhf + zod)"`

---

### Task 4: `ProductsTable` (presentational)

**Files:** Create `apps/admin/app/_components/products-table.tsx`, `apps/admin/app/_components/products-table.test.tsx`.

**Interfaces (Produces):**
```ts
type ProductsTableProps = {
  products: Product[];
  onSetActive: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
};
export function ProductsTable(props: ProductsTableProps): JSX.Element;
```
Renders one row per product (Title, Slug mono, `Price`, Stock, category name, Active/Inactive badge, actions: Edit link `/products/:id/edit`, Activate|Deactivate toggle, Delete). Empty state when `products` is empty.

- [ ] **Step 1: Failing test**

`apps/admin/app/_components/products-table.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@repo/types';
import { ProductsTable } from './products-table';

const base: Product = {
  id: 'p1',
  title: 'Active Widget',
  slug: 'active-widget',
  description: 'd',
  priceCents: 2500,
  currency: 'USD',
  stock: 7,
  images: [],
  isActive: true,
  categoryId: 'c1',
  category: { id: 'c1', name: 'Widgets', slug: 'widgets' },
  createdAt: new Date('2026-01-01'),
};
const inactive: Product = { ...base, id: 'p2', title: 'Hidden Widget', isActive: false };

describe('ProductsTable', () => {
  it('renders a row per product and flags inactive ones', () => {
    render(<ProductsTable products={[base, inactive]} onSetActive={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Active Widget')).toBeInTheDocument();
    expect(screen.getByText('Hidden Widget')).toBeInTheDocument();
    expect(screen.getByText(/inactive/i)).toBeInTheDocument();
  });

  it('deactivates an active product and deletes on demand', () => {
    const onSetActive = vi.fn();
    const onDelete = vi.fn();
    render(<ProductsTable products={[base]} onSetActive={onSetActive} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }));
    expect(onSetActive).toHaveBeenCalledWith('p1', false);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith('p1');
  });

  it('shows an empty state with no products', () => {
    render(<ProductsTable products={[]} onSetActive={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/no products/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter admin test products-table` → FAIL.

- [ ] **Step 3: Implement**

`apps/admin/app/_components/products-table.tsx`:
```tsx
'use client';

import Link from 'next/link';
import type { Product } from '@repo/types';
import { Price } from '@repo/ui';

const cell = 'px-3 py-2 text-left align-middle';
const action = 'text-graphite hover:text-accent';

export function ProductsTable({
  products,
  onSetActive,
  onDelete,
}: {
  products: Product[];
  onSetActive: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
}) {
  if (products.length === 0) {
    return <p className="mt-6 text-sm text-graphite">No products yet.</p>;
  }
  return (
    <table className="mt-6 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-hairline text-xs uppercase tracking-wide text-graphite">
          <th className={cell}>Title</th>
          <th className={cell}>Slug</th>
          <th className={cell}>Price</th>
          <th className={cell}>Stock</th>
          <th className={cell}>Category</th>
          <th className={cell}>Status</th>
          <th className={cell}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr key={p.id} className="border-b border-hairline">
            <td className={cell}>{p.title}</td>
            <td className={`${cell} font-mono text-xs text-graphite`}>{p.slug}</td>
            <td className={cell}>
              <Price cents={p.priceCents} currency={p.currency} />
            </td>
            <td className={cell}>{p.stock}</td>
            <td className={cell}>{p.category?.name ?? '—'}</td>
            <td className={cell}>
              <span className={p.isActive ? 'text-ink' : 'text-graphite'}>
                {p.isActive ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td className={`${cell} space-x-3 whitespace-nowrap`}>
              <Link href={`/products/${p.id}/edit`} className={action}>
                Edit
              </Link>
              <button className={action} onClick={() => onSetActive(p.id, !p.isActive)}>
                {p.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button className={action} onClick={() => onDelete(p.id)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter admin test products-table` → 3 pass.

- [ ] **Step 5: Commit** — `git add apps/admin/app/_components/products-table.tsx apps/admin/app/_components/products-table.test.tsx && git commit -m "feat(admin): products table with status + row actions"`

---

### Task 5: `CategoriesManager` (presentational, rhf + zod)

**Files:** Create `apps/admin/app/_components/categories-manager.tsx`, `apps/admin/app/_components/categories-manager.test.tsx`.

**Interfaces (Produces):**
```ts
type CategoriesManagerProps = {
  categories: Category[];
  onCreate: (input: CreateCategoryInput) => void;
  onUpdate: (id: string, input: UpdateCategoryInput) => void;
  onDelete: (id: string) => void;
  creating?: boolean;
  error?: string | null;
};
export function CategoriesManager(props: CategoriesManagerProps): JSX.Element;
```
A create form (name, slug) validated by `zodResolver(createCategoryInput)`; a list with per-row inline rename (Edit → name input → Save calls `onUpdate`) and Delete; an `error` banner (e.g. the 409 message from the page).

- [ ] **Step 1: Failing test**

`apps/admin/app/_components/categories-manager.test.tsx`:
```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Category } from '@repo/types';
import { CategoriesManager } from './categories-manager';

const categories: Category[] = [{ id: 'c1', name: 'Widgets', slug: 'widgets' }];

describe('CategoriesManager', () => {
  it('creates a category from valid input', async () => {
    const onCreate = vi.fn();
    render(
      <CategoriesManager
        categories={categories}
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Gadgets' } });
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'gadgets' } });
    fireEvent.click(screen.getByRole('button', { name: /add category/i }));
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({ name: 'Gadgets', slug: 'gadgets' }),
    );
  });

  it('deletes a category and shows the error banner', () => {
    const onDelete = vi.fn();
    render(
      <CategoriesManager
        categories={categories}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={onDelete}
        error="You can’t delete a category that still has products."
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith('c1');
    expect(screen.getByText(/still has products/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter admin test categories-manager` → FAIL.

- [ ] **Step 3: Implement**

`apps/admin/app/_components/categories-manager.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createCategoryInput,
  type Category,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@repo/types';
import { Button } from '@repo/ui';

const field = 'w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-ink';

export function CategoriesManager({
  categories,
  onCreate,
  onUpdate,
  onDelete,
  creating,
  error,
}: {
  categories: Category[];
  onCreate: (input: CreateCategoryInput) => void;
  onUpdate: (id: string, input: UpdateCategoryInput) => void;
  onDelete: (id: string) => void;
  creating?: boolean;
  error?: string | null;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCategoryInput>({ resolver: zodResolver(createCategoryInput) });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const submit = handleSubmit((values) => {
    onCreate(values);
    reset({ name: '', slug: '' });
  });

  return (
    <div className="mt-6 max-w-2xl space-y-6">
      {error && <p className="text-sm text-accent">{error}</p>}

      <form onSubmit={submit} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
        <label className="block text-sm text-graphite">
          Name
          <input {...register('name')} className={field} />
          {errors.name && <span className="text-xs text-accent">{errors.name.message}</span>}
        </label>
        <label className="block text-sm text-graphite">
          Slug
          <input {...register('slug')} className={field} />
          {errors.slug && <span className="text-xs text-accent">{errors.slug.message}</span>}
        </label>
        <Button type="submit" disabled={creating}>
          Add category
        </Button>
      </form>

      <ul className="divide-y divide-hairline border-y border-hairline">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 py-2 text-sm">
            {editingId === c.id ? (
              <>
                <input
                  aria-label={`Rename ${c.name}`}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={field}
                />
                <div className="space-x-3 whitespace-nowrap">
                  <button
                    className="text-graphite hover:text-accent"
                    onClick={() => {
                      onUpdate(c.id, { name: editName });
                      setEditingId(null);
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="text-graphite hover:text-accent"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <span>
                  {c.name} <span className="font-mono text-xs text-graphite">/{c.slug}</span>
                </span>
                <div className="space-x-3 whitespace-nowrap">
                  <button
                    className="text-graphite hover:text-accent"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditName(c.name);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="text-graphite hover:text-accent"
                    onClick={() => onDelete(c.id)}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter admin test categories-manager` → 2 pass.

- [ ] **Step 5: Commit** — `git add apps/admin/app/_components/categories-manager.tsx apps/admin/app/_components/categories-manager.test.tsx && git commit -m "feat(admin): categories manager (create/rename/delete)"`

---

### Task 6: Catalog hooks + page wiring

**Files:** Create `apps/admin/lib/catalog.ts`, `apps/admin/app/products/page.tsx`, `apps/admin/app/products/new/page.tsx`, `apps/admin/app/products/[id]/edit/page.tsx`, `apps/admin/app/categories/page.tsx`.

**Interfaces (Consumes):** T2 api-client functions; T3–T5 presentational components; `authed` from `apps/admin/lib/auth-client.ts` (M1).

- [ ] **Step 1: Hooks** — `apps/admin/lib/catalog.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  getAdminProduct,
  listAdminProducts,
  listCategories,
  updateCategory,
  updateProduct,
} from '@repo/api-client';
import type {
  Category,
  CreateCategoryInput,
  CreateProductInput,
  Paginated,
  Product,
  UpdateCategoryInput,
  UpdateProductInput,
} from '@repo/types';
import { authed } from './auth-client';

const PRODUCTS = ['admin', 'products'] as const;
const CATEGORIES = ['admin', 'categories'] as const;

export function useAdminProducts() {
  return useQuery<Paginated<Product>>({
    queryKey: PRODUCTS,
    queryFn: () => authed((o) => listAdminProducts({ limit: 100 }, o)),
  });
}

export function useAdminProduct(id: string) {
  return useQuery<Product>({
    queryKey: ['admin', 'product', id],
    queryFn: () => authed((o) => getAdminProduct(id, o)),
    enabled: Boolean(id),
  });
}

export function useCategories() {
  return useQuery<Category[]>({ queryKey: CATEGORIES, queryFn: () => listCategories() });
}

export function useProductMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: PRODUCTS });
  return {
    create: useMutation({
      mutationFn: (v: CreateProductInput) => authed((o) => createProduct(v, o)),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; input: UpdateProductInput }) =>
        authed((o) => updateProduct(v.id, v.input, o)),
      onSuccess: invalidate,
    }),
    setActive: useMutation({
      mutationFn: (v: { id: string; isActive: boolean }) =>
        authed((o) => updateProduct(v.id, { isActive: v.isActive }, o)),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => authed((o) => deleteProduct(id, o)),
      onSuccess: invalidate,
    }),
  };
}

export function useCategoryMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: CATEGORIES });
  return {
    create: useMutation({
      mutationFn: (v: CreateCategoryInput) => authed((o) => createCategory(v, o)),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; input: UpdateCategoryInput }) =>
        authed((o) => updateCategory(v.id, v.input, o)),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => authed((o) => deleteCategory(id, o)),
      onSuccess: invalidate,
    }),
  };
}
```

- [ ] **Step 2: Products list page** — `apps/admin/app/products/page.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { AdminShell } from '../_components/admin-shell';
import { ProductsTable } from '../_components/products-table';
import { useAdminProducts, useProductMutations } from '@/lib/catalog';

export default function ProductsPage() {
  const products = useAdminProducts();
  const m = useProductMutations();
  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Products</h1>
        <Link
          href="/products/new"
          className="rounded-sm bg-accent px-3 py-2 text-sm text-accent-ink"
        >
          New product
        </Link>
      </div>
      {products.isLoading ? (
        <p className="mt-6 text-graphite">Loading…</p>
      ) : products.isError ? (
        <p className="mt-6 text-accent">Failed to load products.</p>
      ) : (
        <ProductsTable
          products={products.data?.items ?? []}
          onSetActive={(id, isActive) => m.setActive.mutate({ id, isActive })}
          onDelete={(id) => m.remove.mutate(id)}
        />
      )}
      {m.remove.isError && (
        <p className="mt-2 text-sm text-accent">
          Couldn’t delete — the product is referenced by orders. Deactivate it instead.
        </p>
      )}
    </AdminShell>
  );
}
```

- [ ] **Step 3: New product page** — `apps/admin/app/products/new/page.tsx`:
```tsx
'use client';

import { useRouter } from 'next/navigation';
import { AdminShell } from '../../_components/admin-shell';
import { ProductForm } from '../../_components/product-form';
import { useCategories, useProductMutations } from '@/lib/catalog';

export default function NewProductPage() {
  const router = useRouter();
  const cats = useCategories();
  const m = useProductMutations();
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">New product</h1>
      <ProductForm
        categories={cats.data ?? []}
        submitting={m.create.isPending}
        error={m.create.isError ? 'Could not create the product.' : null}
        onSubmit={(v) => m.create.mutate(v, { onSuccess: () => router.push('/products') })}
      />
    </AdminShell>
  );
}
```

- [ ] **Step 4: Edit product page** — `apps/admin/app/products/[id]/edit/page.tsx`:
```tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { AdminShell } from '../../../_components/admin-shell';
import { ProductForm } from '../../../_components/product-form';
import { useAdminProduct, useCategories, useProductMutations } from '@/lib/catalog';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const product = useAdminProduct(id);
  const cats = useCategories();
  const m = useProductMutations();

  if (product.isLoading) {
    return (
      <AdminShell>
        <p className="text-graphite">Loading…</p>
      </AdminShell>
    );
  }
  if (product.isError || !product.data) {
    return (
      <AdminShell>
        <p className="text-accent">Product not found.</p>
      </AdminShell>
    );
  }
  const p = product.data;
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">Edit {p.title}</h1>
      <ProductForm
        categories={cats.data ?? []}
        defaultValues={{
          title: p.title,
          slug: p.slug,
          description: p.description,
          priceCents: p.priceCents,
          currency: p.currency,
          stock: p.stock,
          images: p.images,
          isActive: p.isActive,
          categoryId: p.categoryId,
        }}
        submitting={m.update.isPending}
        error={m.update.isError ? 'Could not update the product.' : null}
        onSubmit={(v) =>
          m.update.mutate({ id: p.id, input: v }, { onSuccess: () => router.push('/products') })
        }
      />
    </AdminShell>
  );
}
```

- [ ] **Step 5: Categories page** — `apps/admin/app/categories/page.tsx`:
```tsx
'use client';

import { ApiError } from '@repo/api-client';
import { AdminShell } from '../_components/admin-shell';
import { CategoriesManager } from '../_components/categories-manager';
import { useCategories, useCategoryMutations } from '@/lib/catalog';

export default function CategoriesPage() {
  const cats = useCategories();
  const m = useCategoryMutations();
  const deleteError =
    m.remove.error instanceof ApiError && m.remove.error.status === 409
      ? 'You can’t delete a category that still has products.'
      : m.remove.isError
        ? 'Could not delete the category.'
        : null;
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">Categories</h1>
      <CategoriesManager
        categories={cats.data ?? []}
        creating={m.create.isPending}
        error={m.create.isError ? 'Could not create the category.' : deleteError}
        onCreate={(v) => m.create.mutate(v)}
        onUpdate={(id, input) => m.update.mutate({ id, input })}
        onDelete={(id) => m.remove.mutate(id)}
      />
    </AdminShell>
  );
}
```

- [ ] **Step 6: Gates** — `pnpm --filter admin test` (all admin tests green); `pnpm --filter admin typecheck`; `pnpm --filter admin lint`; `NODE_ENV=production pnpm --filter admin build` — routes `/products`, `/products/new`, `/products/[id]/edit`, `/categories` present. Reset `next-env.d.ts` before committing.

- [ ] **Step 7: Commit** — `git add apps/admin && git commit -m "feat(admin): wire catalog hooks and product/category pages"`

---

### Task 7: Pipeline + live verification

- [ ] **Step 1: Workspace pipeline** — in `fullstack-dev-1`: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `NODE_ENV=production pnpm build` — all green; `pnpm install --frozen-lockfile` consistent (no dep changes expected in M2, so the lockfile should be unchanged).
- [ ] **Step 2: API live check** — against the running API: log in as the seeded admin; `POST /categories` then `POST /products` with `isActive:false`; confirm `GET /admin/products?limit=100` (admin token) includes the inactive id while `GET /products` (public) does not; `GET /admin/products/:id` returns it; `PATCH /products/:id { isActive:true }` then confirm it appears in public `GET /products`; `DELETE /categories/:id` on a category with a product returns **409**.
- [ ] **Step 3: Admin live check** — start `NODE_ENV=production pnpm --filter admin start`; unauthenticated, `/products` and `/categories` render **0** table/data content pre-auth (RequireAdmin holds, same property verified in M1).
- [ ] **Step 4: Commit any fixes.**

---

## Definition of Done (M2)

- Admin can create, edit, deactivate/activate, and (when unreferenced) delete a product; a newly created active product shows on the storefront; a deactivated one disappears from the storefront but stays visible and editable in the admin.
- Admin can create, rename, and delete categories; deleting a category that still has products shows a friendly 409 message instead of failing.
- `GET /admin/products` / `GET /admin/products/:id` are ADMIN-only (401/403 otherwise) and return inactive products (api e2e proves it); `passwordHash` etc. are irrelevant here (products carry no secrets).
- `lint`, `typecheck`, `test` green across the workspace; `NODE_ENV=production pnpm build` green; frozen-lockfile consistent.
- No contract shapes redefined outside `@repo/types`. Orders UI, `/admin/users`, `/admin/stats`, dashboard, and Playwright land in M3–M4.

---

## Self-Review

- **Spec coverage:** M2 row of §2 (products table + create/edit/delete; categories + CRUD; rhf+zod) → T3–T6. §8 error handling (409 on category delete, friendly messages, empty/loading states) → T5/T6 + ProductsTable empty state. The `isActive`/FK gap surfaced during planning → T1 admin reads + deactivate-first semantics (approved scope option A).
- **Placeholder scan:** none — every step carries complete code or an exact command.
- **Type consistency:** `listAllForAdmin`/`getById` (T1) ↔ `listAdminProducts`/`getAdminProduct` (T2) ↔ `useAdminProducts`/`useAdminProduct` (T6). `ProductForm.onSubmit: (CreateProductInput)=>void` consumed by new/edit pages via `create.mutate`/`update.mutate` (edit maps to `{id,input}` for `updateProductInput` = `createProductInput.partial()`, compatible). `currencyEnum.options` is `readonly ['USD','EUR','GBP']`. `Price` takes `{cents,currency}`. All names match across tasks.
- **YAGNI:** no product search/sort/pagination UI in M2 (list uses `limit:100`, newest-first); no image upload (URL list); role edit out of scope. These are deliberate deferrals per the spec.
