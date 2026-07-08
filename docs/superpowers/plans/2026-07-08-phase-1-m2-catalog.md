# Phase 1 · Milestone M2 — Catalog (read slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Deliver the public catalog: Prisma Category+Product models, seeds, and read endpoints (`GET /categories`, `GET /products` with pagination/filter/search/sort, `GET /products/:slug`) — all covered by e2e.

**Architecture:** Prisma models under Postgres; zod contracts in `@repo/types` drive validation + response typing. Products list returns the standard `Paginated<T>` envelope. Everything read-only and public — no auth dependency.

**Tech Stack:** NestJS 11, Prisma 6, zod, Jest + supertest. Runs in the Docker dev container.

## Scope note — resequencing from the Phase 1 spec

The Phase 1 spec bundled "admin CRUD" into M2. Admin mutations require the `RolesGuard` delivered in M3, so to avoid ever shipping unguarded mutation endpoints, **admin CRUD moves to M3** (ships already guarded). M2 is the public read slice only. `User` model + auth models also arrive in M3; M2 adds only `Category` + `Product`.

## Global Constraints (inherited)

- Runtimes: Node ≥20, pnpm ≥9. All node/pnpm/prisma commands run in the container: `docker compose exec dev <cmd>`.
- TypeScript strict everywhere. Routes under `api/v1`. Error shape `{ statusCode, message, errors? }`.
- Money as integer cents. Contracts live in `@repo/types` (zod, single source of truth).
- e2e uses `--runInBand --forceExit`. Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File Structure (created by M2)

```
apps/api/prisma/schema.prisma              # + Category, Product models
apps/api/prisma/migrations/…               # generated migration
apps/api/prisma/seed.ts                    # idempotent categories + products
packages/types/src/category.ts             # Category contracts
packages/types/src/product.ts              # Product + ProductListQuery contracts
packages/types/src/product.test.ts         # contract tests
apps/api/src/categories/categories.service.ts
apps/api/src/categories/categories.controller.ts
apps/api/src/categories/categories.module.ts
apps/api/src/products/products.service.ts
apps/api/src/products/products.controller.ts
apps/api/src/products/products.module.ts
apps/api/test/catalog.e2e-spec.ts          # public read e2e
```

---

## Task 1: Catalog data model — Prisma models, migration, contracts

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration (generated), `packages/types/src/category.ts`, `packages/types/src/product.ts`, `packages/types/src/product.test.ts`
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces: Prisma `Category`, `Product`; `@repo/types` exports `category`, `Category`, `product`, `Product`, `productListQuery`, `ProductListQuery`.

- [ ] **Step 1: Add Prisma models**

Append to `apps/api/prisma/schema.prisma`:
```prisma
model Category {
  id       String    @id @default(uuid())
  name     String
  slug     String    @unique
  products Product[]
}

model Product {
  id          String   @id @default(uuid())
  title       String
  slug        String   @unique
  description String
  priceCents  Int
  currency    String   @default("USD")
  stock       Int      @default(0)
  images      String[]
  isActive    Boolean  @default(true)
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id])
  createdAt   DateTime @default(now())
  @@index([categoryId])
}
```

- [ ] **Step 2: Create + apply the migration**

Run: `docker compose exec dev pnpm --filter api exec prisma migrate dev --name catalog`
Expected: migration file created under `prisma/migrations/`, applied to Postgres, Prisma Client regenerated. Verify: `docker compose exec dev pnpm --filter api exec prisma migrate status` → up to date.

- [ ] **Step 3: Write the failing contract test**

`packages/types/src/product.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { productListQuery } from './product';

describe('productListQuery', () => {
  it('applies defaults', () => {
    expect(productListQuery.parse({})).toEqual({ page: 1, limit: 20, sort: 'newest' });
  });
  it('coerces price bounds and keeps filters', () => {
    const q = productListQuery.parse({ minPriceCents: '1000', category: 'audio', sort: 'price_asc' });
    expect(q.minPriceCents).toBe(1000);
    expect(q.category).toBe('audio');
    expect(q.sort).toBe('price_asc');
  });
  it('rejects an invalid sort', () => {
    expect(() => productListQuery.parse({ sort: 'nope' })).toThrow();
  });
});
```

- [ ] **Step 4: Run test — expect FAIL** (`Cannot find module './product'`)

Run: `docker compose exec dev pnpm --filter @repo/types test`

- [ ] **Step 5: Implement contracts**

`packages/types/src/category.ts`:
```ts
import { z } from 'zod';

export const category = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});
export type Category = z.infer<typeof category>;
```

`packages/types/src/product.ts`:
```ts
import { z } from 'zod';
import { pageQuery } from './common';

export const product = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  priceCents: z.number().int(),
  currency: z.string(),
  stock: z.number().int(),
  images: z.array(z.string()),
  isActive: z.boolean(),
  categoryId: z.string().uuid(),
  category: z.object({ id: z.string().uuid(), name: z.string(), slug: z.string() }).optional(),
  createdAt: z.coerce.date(),
});
export type Product = z.infer<typeof product>;

export const productListQuery = pageQuery.extend({
  category: z.string().trim().min(1).optional(), // category slug
  q: z.string().trim().min(1).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
});
export type ProductListQuery = z.infer<typeof productListQuery>;
```

Append to `packages/types/src/index.ts`:
```ts
export * from './category';
export * from './product';
```

- [ ] **Step 6: Run test — expect PASS**; then `docker compose exec dev pnpm --filter @repo/types build`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(catalog): add Category/Product models, migration, and contracts"
```

---

## Task 2: Seed script — idempotent categories + products

**Files:**
- Create: `apps/api/prisma/seed.ts`
- Modify: `apps/api/package.json` (add `prisma.seed` + `db:seed` script; add `tsx` dev dep)

**Interfaces:**
- Produces: a runnable seed creating ~3 categories and ~12 products. Idempotent via `upsert` on unique `slug`.

- [ ] **Step 1: Add seed config + dep**

In `apps/api/package.json` add script `"db:seed": "prisma db seed"`, a `"prisma": { "seed": "tsx prisma/seed.ts" }` block, and dev dep `tsx`. Then `docker compose exec dev pnpm install`.

- [ ] **Step 2: Write the seed**

`apps/api/prisma/seed.ts`:
```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: 'Audio', slug: 'audio' },
  { name: 'Wearables', slug: 'wearables' },
  { name: 'Accessories', slug: 'accessories' },
];

async function main(): Promise<void> {
  const bySlug: Record<string, string> = {};
  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
    bySlug[c.slug] = row.id;
  }

  const products = [
    { title: 'Wireless Headphones', slug: 'wireless-headphones', priceCents: 12900, stock: 25, cat: 'audio' },
    { title: 'Studio Earbuds', slug: 'studio-earbuds', priceCents: 8900, stock: 40, cat: 'audio' },
    { title: 'Portable Speaker', slug: 'portable-speaker', priceCents: 5900, stock: 30, cat: 'audio' },
    { title: 'Smart Watch', slug: 'smart-watch', priceCents: 19900, stock: 15, cat: 'wearables' },
    { title: 'Fitness Band', slug: 'fitness-band', priceCents: 4900, stock: 50, cat: 'wearables' },
    { title: 'VR Headset', slug: 'vr-headset', priceCents: 29900, stock: 8, cat: 'wearables' },
    { title: 'USB-C Cable', slug: 'usb-c-cable', priceCents: 1200, stock: 200, cat: 'accessories' },
    { title: 'Laptop Sleeve', slug: 'laptop-sleeve', priceCents: 3400, stock: 60, cat: 'accessories' },
    { title: 'Wireless Charger', slug: 'wireless-charger', priceCents: 2600, stock: 45, cat: 'accessories' },
    { title: 'Phone Stand', slug: 'phone-stand', priceCents: 1500, stock: 80, cat: 'accessories' },
    { title: 'Noise-Cancelling Headset', slug: 'nc-headset', priceCents: 17900, stock: 12, cat: 'audio' },
    { title: 'Travel Adapter', slug: 'travel-adapter', priceCents: 2200, stock: 90, cat: 'accessories' },
  ];

  for (const p of products) {
    const { cat, ...rest } = p;
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: { priceCents: p.priceCents, stock: p.stock },
      create: {
        ...rest,
        description: `${p.title} — demo catalog item.`,
        images: [],
        categoryId: bySlug[cat],
      },
    });
  }

  const [c, pc] = [await prisma.category.count(), await prisma.product.count()];
  console.log(`Seeded: ${c} categories, ${pc} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Run the seed (twice — proves idempotency)**

Run: `docker compose exec dev pnpm --filter api db:seed && docker compose exec dev pnpm --filter api db:seed`
Expected: both print `Seeded: 3 categories, 12 products` (counts stable, no duplicate-key errors).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(catalog): add idempotent seed for demo categories and products"
```

---

## Task 3: Categories read API (TDD e2e)

**Files:**
- Create: `apps/api/src/categories/{categories.service.ts,categories.controller.ts,categories.module.ts}`
- Modify: `apps/api/src/app.module.ts` (import `CategoriesModule`)
- Test: extend `apps/api/test/catalog.e2e-spec.ts` (created here)

**Interfaces:**
- Consumes: `PrismaService`.
- Produces: `GET /api/v1/categories → Category[]` (ordered by name).

- [ ] **Step 1: Write failing e2e**

`apps/api/test/catalog.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Catalog (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('GET /categories -> seeded categories', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body[0]).toHaveProperty('slug');
  });
});
```
> Precondition: seed has been run (Task 2). e2e reads seeded data.

- [ ] **Step 2: Run — expect FAIL** (404, no categories route). `docker compose exec dev pnpm --filter api test:e2e`

- [ ] **Step 3: Implement**

`categories.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}
  list() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }
}
```

`categories.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}
  @Get()
  list() {
    return this.categories.list();
  }
}
```

`categories.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({ controllers: [CategoriesController], providers: [CategoriesService] })
export class CategoriesModule {}
```

Add `CategoriesModule` to `AppModule` imports.

- [ ] **Step 4: Run — expect PASS.** Commit:
```bash
git add -A
git commit -m "feat(catalog): public categories listing endpoint"
```

---

## Task 4: Products read API — pagination, filter, search, sort, by-slug (TDD e2e)

**Files:**
- Create: `apps/api/src/products/{products.service.ts,products.controller.ts,products.module.ts}`
- Modify: `apps/api/src/app.module.ts` (import `ProductsModule`)
- Test: extend `apps/api/test/catalog.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `productListQuery`/`ProductListQuery` from `@repo/types`.
- Produces: `GET /api/v1/products → Paginated<Product>` (filter `category` slug, `q` search, price bounds, `sort`); `GET /api/v1/products/:slug → Product` (404 if missing).

- [ ] **Step 1: Add failing e2e cases**

Append to `catalog.e2e-spec.ts` inside the describe:
```ts
  it('GET /products -> paginated envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/products?limit=5').expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({ page: 1, limit: 5, total: expect.any(Number), items: expect.any(Array) }),
    );
    expect(res.body.items.length).toBeLessThanOrEqual(5);
  });

  it('GET /products?category=audio -> only audio products', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/products?category=audio&limit=50').expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const p of res.body.items) expect(p.category.slug).toBe('audio');
  });

  it('GET /products?sort=price_asc -> ascending by price', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/products?sort=price_asc&limit=50').expect(200);
    const prices = res.body.items.map((p: { priceCents: number }) => p.priceCents);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('GET /products/:slug -> one product; unknown -> 404', async () => {
    await request(app.getHttpServer()).get('/api/v1/products/wireless-headphones').expect(200);
    await request(app.getHttpServer()).get('/api/v1/products/does-not-exist').expect(404);
  });
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement service (the query logic)**

`products.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ProductListQuery, Paginated, Product } from '@repo/types';
import { PrismaService } from '../prisma/prisma.service';

const ORDER: Record<ProductListQuery['sort'], Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  price_asc: { priceCents: 'asc' },
  price_desc: { priceCents: 'desc' },
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ProductListQuery): Promise<Paginated<Product>> {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.minPriceCents !== undefined || query.maxPriceCents !== undefined
        ? { priceCents: { gte: query.minPriceCents, lte: query.maxPriceCents } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true, slug: true } } },
        orderBy: ORDER[query.sort],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items: items as unknown as Product[], total, page: query.page, limit: query.limit };
  }

  async getBySlug(slug: string): Promise<Product> {
    const found = await this.prisma.product.findUnique({
      where: { slug },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!found) throw new NotFoundException(`Product "${slug}" not found`);
    return found as unknown as Product;
  }
}
```

- [ ] **Step 4: Implement controller + module**

`products.controller.ts`:
```ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { productListQuery } from '@repo/types';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.products.list(productListQuery.parse(query));
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.products.getBySlug(slug);
  }
}
```
> `productListQuery.parse` coerces/validates the raw query (defaults applied); a bad `sort` throws → global filter returns 400.

`products.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({ controllers: [ProductsController], providers: [ProductsService] })
export class ProductsModule {}
```

Add `ProductsModule` to `AppModule` imports.

- [ ] **Step 5: Run e2e — expect PASS (all catalog cases).**

Run: `docker compose exec dev pnpm --filter api test:e2e`

- [ ] **Step 6: Full pipeline + commit**

Run: `docker compose exec dev sh -c "pnpm lint && pnpm typecheck && pnpm test && pnpm --filter api test:e2e && pnpm build"`
```bash
git add -A
git commit -m "feat(catalog): public products listing with pagination, filter, search, sort"
```

---

## Self-Review

- **Spec coverage (M2 read slice):** models+migration (T1), contracts (T1), seeds (T2), public categories (T3), public products list with pagination/filter/search/sort + by-slug (T4). Admin CRUD explicitly deferred to M3. ✓
- **Placeholders:** none — every step has full code/commands. ✓
- **Type consistency:** `productListQuery`/`ProductListQuery`, `product`/`Product`, `Paginated<T>` (from M1) used consistently; `category` slug filter matches seed slugs; envelope matches M1's `Paginated`. ✓
- **Ordering caveat:** e2e depends on seeded data (Task 2 before Tasks 3–4). CI must seed before e2e — add a seed step in a follow-up if CI e2e is extended to catalog (M2 note for the CI update).
