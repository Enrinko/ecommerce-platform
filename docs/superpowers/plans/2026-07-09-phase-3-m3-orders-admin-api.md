# Phase 3 · M3 — Orders admin UI + `/admin/users` & `/admin/stats` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin browse every order and move it through the status machine, and stand up the two new ADMIN endpoints (`GET /admin/users`, `GET /admin/stats`) — typed, guarded, tested — that M4's dashboard and users table will consume.

**Architecture:** New Nest `AdminModule` (`@Controller('admin')`) exposes `GET /admin/users` (paginated, `orderCount` via relation-count, **never** serializes `passwordHash`/`tokenHash`) and `GET /admin/stats` (Prisma aggregates; revenue = Σ `totalCents` of PAID/SHIPPED/DELIVERED). Contracts live in a new `@repo/types` `admin.ts`; the order-status machine moves to `@repo/types` so the admin select and the server guard share one map. The admin orders UI is client-heavy (TanStack Query over the authed client): presentational `OrdersTable` + `OrderStatusControl` (offers only valid transitions; server still enforces and 409s), wired by thin pages `/orders` and `/orders/[id]`.

**Tech Stack:** NestJS (Prisma) · Next 15 App Router · React 19 · `@repo/api-client`/`@repo/ui`/`@repo/types` · TanStack Query 5 · Vitest + @testing-library/react · supertest.

## Global Constraints

- **Measured** dense admin layout (`@repo/ui` tokens/fonts), same conventions as M1/M2.
- Contracts in `@repo/types` **only**. M3 adds `admin.ts` (`userListItem`, `adminStats`, `ordersByStatus`) and `orderTransitions`/`nextStatuses` in `order.ts`. `@repo/types` is consumed from built `dist` → after editing `packages/types/src/**` run `pnpm --filter @repo/types build` before dependents typecheck/build/test.
- **Security:** `/admin/users` & `/admin/stats` behind `JwtAuthGuard + RolesGuard @Roles('ADMIN')` (401 anon / 403 customer). `/admin/users` uses an explicit Prisma `select` — `passwordHash` and `tokenHash` MUST NOT appear in the response.
- **Revenue = Σ `totalCents` where status ∈ {PAID, SHIPPED, DELIVERED}** (paid orders; PENDING and CANCELLED excluded).
- Order-status machine is the single source in `@repo/types`; the API's `order-status.ts` derives from it (server still validates every transition — defense in depth; the UI only *hints* valid options).
- Testing convention (as web/M2): behaviour tested on presentational components + api-client unit + api e2e; thin hooks (`lib/orders.ts`) and thin pages covered by typecheck/build + M4 Playwright.
- Commands in `fullstack-dev-1`. Admin prod build `NODE_ENV=production pnpm --filter admin build`; API e2e `pnpm --filter api test:e2e`. Conventional Commits; PR only when the milestone is done and asked.
- Money is integer cents throughout. Pagination envelope `{ items, total, page, limit }`, `limit ≤ 100`.

---

## File Structure

```
packages/types/src/
├─ admin.ts                       # NEW → userListItem, adminStats, ordersByStatus            (+test)
├─ order.ts                       # UPDATE → orderTransitions + nextStatuses()
└─ index.ts                       # UPDATE → export ./admin

apps/api/src/
├─ admin/
│  ├─ admin.service.ts            # NEW → listUsers(), stats()
│  ├─ admin.controller.ts         # NEW → GET /admin/users, GET /admin/stats (ADMIN)
│  └─ admin.module.ts             # NEW
├─ app.module.ts                  # UPDATE → import AdminModule
└─ orders/
   ├─ orders.service.ts           # UPDATE → include user{id,email} in listAll + getOne
   └─ order-status.ts             # UPDATE → derive ALLOWED_TRANSITIONS from @repo/types
apps/api/test/
├─ admin-users-stats.e2e-spec.ts  # NEW
└─ orders.e2e-spec.ts             # UPDATE → admin order list carries customer email

packages/api-client/src/
├─ admin.ts                       # UPDATE → listUsers(query), getAdminStats()               (+test)
├─ admin.test.ts                  # UPDATE
└─ orders.ts                      # UPDATE → richer Order (items typed, createdAt, user, payment, shipping)

apps/admin/
├─ lib/orders.ts                  # NEW → useAdminOrders / useAdminOrder / useOrderStatusMutation
└─ app/
   ├─ _components/
   │  ├─ orders-table.tsx         # NEW (presentational)                                      (+test)
   │  └─ order-status-control.tsx # NEW (presentational)                                      (+test)
   └─ orders/
      ├─ page.tsx                 # NEW → all-orders table
      └─ [id]/page.tsx            # NEW → detail + status control
```

Order: types (T1) → API users/stats (T2) → API orders enrich + status-machine source (T3) → api-client (T4) → admin presentational (T5) → admin hooks+pages (T6) → pipeline+live (T7).

---

### Task 1: `@repo/types` — admin contracts + order transitions

**Files:** Create `packages/types/src/admin.ts`, `packages/types/src/admin.test.ts`; Modify `packages/types/src/order.ts`, `packages/types/src/index.ts`.

**Interfaces (Produces):**
- `userListItem` / `UserListItem = { id, email, role: 'CUSTOMER'|'ADMIN', createdAt: Date, orderCount: number }`
- `adminStats` / `AdminStats = { ordersTotal, ordersByStatus: {PENDING,PAID,SHIPPED,DELIVERED,CANCELLED: number}, revenueCents, productCount, userCount }`
- `orderTransitions: Record<OrderStatusValue, OrderStatusValue[]>`, `nextStatuses(s): OrderStatusValue[]`

- [ ] **Step 1: Failing test** — `packages/types/src/admin.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { adminStats, userListItem } from './admin';
import { nextStatuses } from './order';

describe('admin contracts', () => {
  it('parses a user list item', () => {
    const v = userListItem.parse({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'a@b.io',
      role: 'ADMIN',
      createdAt: '2026-01-01T00:00:00Z',
      orderCount: 3,
    });
    expect(v.orderCount).toBe(3);
    expect(v.createdAt).toBeInstanceOf(Date);
  });

  it('parses admin stats with every status bucket', () => {
    const v = adminStats.parse({
      ordersTotal: 5,
      ordersByStatus: { PENDING: 1, PAID: 2, SHIPPED: 1, DELIVERED: 1, CANCELLED: 0 },
      revenueCents: 999,
      productCount: 10,
      userCount: 4,
    });
    expect(v.revenueCents).toBe(999);
  });

  it('rejects stats missing a status bucket', () => {
    expect(() =>
      adminStats.parse({
        ordersTotal: 0,
        ordersByStatus: { PENDING: 0 },
        revenueCents: 0,
        productCount: 0,
        userCount: 0,
      }),
    ).toThrow();
  });
});

describe('order transitions', () => {
  it('lists valid next statuses', () => {
    expect(nextStatuses('PAID')).toEqual(['SHIPPED', 'CANCELLED']);
    expect(nextStatuses('DELIVERED')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter @repo/types test admin"` → FAIL (missing modules/exports).

- [ ] **Step 3: Implement** — append to `packages/types/src/order.ts`:
```ts
// Single source of truth for the order lifecycle (server enforces; UI hints).
export const orderTransitions: Record<OrderStatusValue, OrderStatusValue[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function nextStatuses(status: OrderStatusValue): OrderStatusValue[] {
  return orderTransitions[status];
}
```

Create `packages/types/src/admin.ts`:
```ts
import { z } from 'zod';

export const userListItem = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['CUSTOMER', 'ADMIN']),
  createdAt: z.coerce.date(),
  orderCount: z.number().int(),
});
export type UserListItem = z.infer<typeof userListItem>;

export const ordersByStatus = z.object({
  PENDING: z.number().int(),
  PAID: z.number().int(),
  SHIPPED: z.number().int(),
  DELIVERED: z.number().int(),
  CANCELLED: z.number().int(),
});
export type OrdersByStatus = z.infer<typeof ordersByStatus>;

export const adminStats = z.object({
  ordersTotal: z.number().int(),
  ordersByStatus,
  revenueCents: z.number().int(),
  productCount: z.number().int(),
  userCount: z.number().int(),
});
export type AdminStats = z.infer<typeof adminStats>;
```

Append to `packages/types/src/index.ts`: `export * from './admin';`

- [ ] **Step 4: Run, verify pass + build** — `pnpm --filter @repo/types test admin` green; then **`pnpm --filter @repo/types build`** (dependents read `dist`). Full `pnpm --filter @repo/types test` stays green.

- [ ] **Step 5: Commit** — `git add packages/types && git commit -m "feat(types): admin user/stats contracts + shared order transitions"`

---

### Task 2: API — `GET /admin/users` + `GET /admin/stats`

**Files:** Create `apps/api/src/admin/admin.service.ts`, `admin.controller.ts`, `admin.module.ts`; Modify `apps/api/src/app.module.ts`; Test `apps/api/test/admin-users-stats.e2e-spec.ts`.

**Interfaces (Produces):**
- `AdminService.listUsers(query: PageQuery): Promise<Paginated<UserListItem>>`
- `AdminService.stats(): Promise<AdminStats>`
- Routes `GET /api/v1/admin/users`, `GET /api/v1/admin/stats` (ADMIN).

- [ ] **Step 1: Failing e2e** — `apps/api/test/admin-users-stats.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Admin users + stats (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let customerToken: string;

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
      .send({ email: `ustats_${Date.now()}@example.com`, password: 'secret123' });
    customerToken = cust.body.accessToken;
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /admin/users rejects anon (401) and customer (403)', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('GET /admin/users returns a page without password hashes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({ total: expect.any(Number), page: 1, limit: 100 }),
    );
    expect(Array.isArray(res.body.items)).toBe(true);
    const admin = res.body.items.find(
      (u: { email: string }) => u.email === process.env.ADMIN_EMAIL,
    );
    expect(admin).toBeTruthy();
    expect(admin).toEqual(
      expect.objectContaining({ role: 'ADMIN', orderCount: expect.any(Number) }),
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('tokenHash');
  });

  it('GET /admin/stats returns coherent aggregates for an admin', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/stats').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const s = res.body;
    for (const k of ['ordersTotal', 'revenueCents', 'productCount', 'userCount']) {
      expect(typeof s[k]).toBe('number');
    }
    const buckets = s.ordersByStatus;
    expect(Object.keys(buckets).sort()).toEqual(
      ['CANCELLED', 'DELIVERED', 'PAID', 'PENDING', 'SHIPPED'],
    );
    const sum = Object.values(buckets).reduce((a: number, b) => a + (b as number), 0);
    expect(sum).toBe(s.ordersTotal);
    expect(s.revenueCents).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter api test:e2e admin-users-stats` → FAIL (404).

- [ ] **Step 3: Implement service** — `apps/api/src/admin/admin.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { OrderStatus } from '@prisma/client';
import type { AdminStats, PageQuery, Paginated, UserListItem } from '@repo/types';
import { PrismaService } from '../prisma/prisma.service';

const REVENUE_STATUSES: OrderStatus[] = ['PAID', 'SHIPPED', 'DELIVERED'];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers({ page, limit }: PageQuery): Promise<Paginated<UserListItem>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count(),
    ]);
    const items: UserListItem[] = rows.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      orderCount: u._count.orders,
    }));
    return { items, total, page, limit };
  }

  async stats(): Promise<AdminStats> {
    const [ordersTotal, grouped, revenue, productCount, userCount] = await this.prisma.$transaction([
      this.prisma.order.count(),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.aggregate({
        _sum: { totalCents: true },
        where: { status: { in: REVENUE_STATUSES } },
      }),
      this.prisma.product.count(),
      this.prisma.user.count(),
    ]);
    const ordersByStatus = { PENDING: 0, PAID: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 };
    for (const g of grouped) ordersByStatus[g.status] = g._count._all;
    return {
      ordersTotal,
      ordersByStatus,
      revenueCents: revenue._sum.totalCents ?? 0,
      productCount,
      userCount,
    };
  }
}
```

- [ ] **Step 4: Implement controller + module** — `apps/api/src/admin/admin.controller.ts`:
```ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { pageQuery } from '@repo/types';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users(@Query() query: unknown) {
    return this.admin.listUsers(pageQuery.parse(query));
  }

  @Get('stats')
  stats() {
    return this.admin.stats();
  }
}
```
`apps/api/src/admin/admin.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({ controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
```
Register in `apps/api/src/app.module.ts`: import `AdminModule` and add it to `imports` (after `OrdersModule`). (PrismaService is `@Global`, so no PrismaModule import needed here.)

- [ ] **Step 5: Run, verify pass** — `pnpm --filter api test:e2e admin-users-stats` → all pass. Full `pnpm --filter api test:e2e` green.

- [ ] **Step 6: Commit** — `git add apps/api/src/admin apps/api/src/app.module.ts apps/api/test/admin-users-stats.e2e-spec.ts && git commit -m "feat(api): admin users list + stats endpoints (ADMIN)"`

---

### Task 3: API — customer email on admin order reads + shared status machine

**Files:** Modify `apps/api/src/orders/orders.service.ts`, `apps/api/src/orders/order-status.ts`; Test: extend `apps/api/test/orders.e2e-spec.ts`.

**Interfaces:** `listAll`/`getOne` responses gain `user: { id, email }`. `ALLOWED_TRANSITIONS` now derives from `@repo/types` `orderTransitions` (behaviour unchanged).

- [ ] **Step 1: Failing test** — add to `apps/api/test/orders.e2e-spec.ts` a case asserting the admin order list carries the customer's email. (Place it in the existing admin-orders describe block; reuse that block's `adminToken`.) Example assertion after fetching `GET /api/v1/admin/orders?limit=100`:
```ts
  it('exposes the customer email on admin order rows', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/orders?limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0].user).toEqual(
      expect.objectContaining({ email: expect.any(String) }),
    );
  });
```
(If `orders.e2e-spec.ts` has no admin-orders block that already creates an order, add the assertion after an existing checkout so at least one order exists; match the file's existing token variable names.)

- [ ] **Step 2: Run, verify fail** — `pnpm --filter api test:e2e orders` → the new case FAILs (`user` undefined).

- [ ] **Step 3: Implement** — in `apps/api/src/orders/orders.service.ts`, add the user relation to both admin-reachable reads:
  - `listAll`: change `include: { items: true, payment: true }` → `include: { items: true, payment: true, user: { select: { id: true, email: true } } }`.
  - `getOne`: change `include: { items: true, payment: true }` → `include: { items: true, payment: true, user: { select: { id: true, email: true } } }`.

  Then make `apps/api/src/orders/order-status.ts` derive from the shared map:
```ts
import type { OrderStatus } from '@prisma/client';
import { orderTransitions } from '@repo/types';

export const ALLOWED_TRANSITIONS = orderTransitions as Record<OrderStatus, OrderStatus[]>;

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter api test:e2e orders` green; full `pnpm --filter api test:e2e` green; `pnpm --filter api typecheck` clean.

- [ ] **Step 5: Commit** — `git add apps/api/src/orders apps/api/test/orders.e2e-spec.ts && git commit -m "feat(api): customer email on admin orders; share status machine via @repo/types"`

---

### Task 4: `@repo/api-client` — `listUsers`, `getAdminStats`, richer `Order`

**Files:** Modify `packages/api-client/src/admin.ts`, `packages/api-client/src/orders.ts`; Test `packages/api-client/src/admin.test.ts`.

**Interfaces (Produces):**
- `listUsers(query: Partial<PageQuery> = {}, opts?): Promise<Paginated<UserListItem>>` → `GET /admin/users`
- `getAdminStats(opts?): Promise<AdminStats>` → `GET /admin/stats`
- Enriched `Order` type (typed `items`, `createdAt`, `shippingName/Addr`, optional `payment`, optional `user`).

- [ ] **Step 1: Failing test** — append to `packages/api-client/src/admin.test.ts` (and extend the top import from `./index`):
```ts
  it('reads the admin users page and stats', async () => {
    const spy = capture(200, { items: [], total: 0, page: 1, limit: 100 });
    await listUsers({ limit: 100 }, { baseUrl: 'http://api', accessToken: 'tok' });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api/admin/users?limit=100');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok');

    const spy2 = capture(200, { ordersTotal: 0 });
    await getAdminStats({ baseUrl: 'http://api' });
    expect(spy2.mock.calls[0][0]).toBe('http://api/admin/stats');
  });
```
Import line becomes: `import { createProduct, getAdminProduct, getAdminStats, listAdminProducts, listAllOrders, listUsers, updateOrderStatus } from './index';`

- [ ] **Step 2: Run, verify fail** — `pnpm --filter @repo/api-client test` → FAIL.

- [ ] **Step 3: Implement** — in `packages/api-client/src/admin.ts`, extend the type import with `AdminStats` and `UserListItem`, then add:
```ts
export function listUsers(
  query: Partial<PageQuery> = {},
  opts?: RequestOptions,
): Promise<Paginated<UserListItem>> {
  return apiFetch<Paginated<UserListItem>>(`/admin/users${toQuery(query)}`, opts);
}
export function getAdminStats(opts?: RequestOptions): Promise<AdminStats> {
  return apiFetch<AdminStats>('/admin/stats', opts);
}
```
Replace the loose `Order`/`OrderList` in `packages/api-client/src/orders.ts` with a richer (additive) shape:
```ts
export type OrderItem = {
  id: string;
  productId: string;
  titleSnapshot: string;
  priceCentsSnapshot: number;
  qty: number;
};
export type Order = {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  shippingName: string;
  shippingAddr: string;
  createdAt: string;
  items: OrderItem[];
  payment?: { status: string; provider: string; amountCents: number } | null;
  user?: { id: string; email: string };
};
export type OrderList = { items: Order[]; total: number; page: number; limit: number };
```
(Keep the existing `checkout`/`listMyOrders`/`getOrder` function bodies unchanged.)

- [ ] **Step 4: Run, verify pass + typecheck (api-client AND web)** — `pnpm --filter @repo/api-client test` green; `pnpm --filter @repo/api-client typecheck` clean; **`pnpm --filter web typecheck`** clean (the storefront consumes `Order`; the enrichment is additive but confirm no break).

- [ ] **Step 5: Commit** — `git add packages/api-client && git commit -m "feat(api-client): admin users/stats + richer Order type"`

---

### Task 5: admin presentational — `OrdersTable` + `OrderStatusControl`

**Files:** Create `apps/admin/app/_components/orders-table.tsx` (+`.test.tsx`), `apps/admin/app/_components/order-status-control.tsx` (+`.test.tsx`).

**Interfaces (Produces):**
```ts
function OrdersTable(props: { orders: Order[] }): JSX.Element;
function OrderStatusControl(props: {
  status: OrderStatusValue;
  onChange: (next: OrderStatusValue) => void;
  pending?: boolean;
  error?: string | null;
}): JSX.Element;
```

- [ ] **Step 1: Failing tests**

`apps/admin/app/_components/orders-table.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Order } from '@repo/api-client';
import { OrdersTable } from './orders-table';

const order: Order = {
  id: 'abcdef12-0000-0000-0000-000000000000',
  status: 'PAID',
  totalCents: 4200,
  currency: 'USD',
  shippingName: 'Ada',
  shippingAddr: '1 Rue',
  createdAt: '2026-02-01T00:00:00.000Z',
  items: [],
  user: { id: 'u1', email: 'ada@x.io' },
};

describe('OrdersTable', () => {
  it('renders a row with customer email and status', () => {
    render(<OrdersTable orders={[order]} />);
    expect(screen.getByText('ada@x.io')).toBeInTheDocument();
    expect(screen.getByText('PAID')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view/i })).toHaveAttribute(
      'href',
      '/orders/abcdef12-0000-0000-0000-000000000000',
    );
  });

  it('shows an empty state', () => {
    render(<OrdersTable orders={[]} />);
    expect(screen.getByText(/no orders/i)).toBeInTheDocument();
  });
});
```

`apps/admin/app/_components/order-status-control.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrderStatusControl } from './order-status-control';

describe('OrderStatusControl', () => {
  it('offers only valid transitions and applies the chosen one', () => {
    const onChange = vi.fn();
    render(<OrderStatusControl status="PAID" onChange={onChange} />);
    const options = Array.from(screen.getByRole('combobox').querySelectorAll('option'))
      .map((o) => (o as HTMLOptionElement).value)
      .filter(Boolean);
    expect(options).toEqual(['SHIPPED', 'CANCELLED']);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'SHIPPED' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onChange).toHaveBeenCalledWith('SHIPPED');
  });

  it('shows a terminal state with no control', () => {
    render(<OrderStatusControl status="DELIVERED" onChange={vi.fn()} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText(/final state/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter admin test orders-table order-status-control` → FAIL.

- [ ] **Step 3: Implement**

`apps/admin/app/_components/orders-table.tsx`:
```tsx
'use client';

import Link from 'next/link';
import type { Order } from '@repo/api-client';
import { Price } from '@repo/ui';

const cell = 'px-3 py-2 text-left align-middle';

export function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <p className="mt-6 text-sm text-graphite">No orders yet.</p>;
  }
  return (
    <table className="mt-6 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-hairline text-xs uppercase tracking-wide text-graphite">
          <th className={cell}>Order</th>
          <th className={cell}>Customer</th>
          <th className={cell}>Status</th>
          <th className={cell}>Total</th>
          <th className={cell}>Placed</th>
          <th className={cell}></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id} className="border-b border-hairline">
            <td className={`${cell} font-mono text-xs text-graphite`}>{o.id.slice(0, 8)}</td>
            <td className={cell}>{o.user?.email ?? '—'}</td>
            <td className={cell}>{o.status}</td>
            <td className={cell}>
              <Price cents={o.totalCents} currency={o.currency} />
            </td>
            <td className={cell}>{new Date(o.createdAt).toLocaleDateString()}</td>
            <td className={cell}>
              <Link href={`/orders/${o.id}`} className="text-graphite hover:text-accent">
                View
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

`apps/admin/app/_components/order-status-control.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { nextStatuses, type OrderStatusValue } from '@repo/types';
import { Button } from '@repo/ui';

export function OrderStatusControl({
  status,
  onChange,
  pending,
  error,
}: {
  status: OrderStatusValue;
  onChange: (next: OrderStatusValue) => void;
  pending?: boolean;
  error?: string | null;
}) {
  const options = nextStatuses(status);
  const [next, setNext] = useState<OrderStatusValue | ''>('');

  if (options.length === 0) {
    return <p className="text-sm text-graphite">This order is in a final state ({status}).</p>;
  }
  return (
    <div className="flex items-center gap-3">
      <select
        aria-label="New status"
        value={next}
        onChange={(e) => setNext(e.target.value as OrderStatusValue)}
        className="rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-ink"
      >
        <option value="" disabled>
          Change status…
        </option>
        {options.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <Button disabled={pending || !next} onClick={() => next && onChange(next)}>
        Apply
      </Button>
      {error && <span className="text-sm text-accent">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter admin test orders-table order-status-control` → 4 pass.

- [ ] **Step 5: Commit** — `git add apps/admin/app/_components/orders-table.tsx apps/admin/app/_components/orders-table.test.tsx apps/admin/app/_components/order-status-control.tsx apps/admin/app/_components/order-status-control.test.tsx && git commit -m "feat(admin): orders table + status control components"`

---

### Task 6: admin orders hooks + pages

**Files:** Create `apps/admin/lib/orders.ts`, `apps/admin/app/orders/page.tsx`, `apps/admin/app/orders/[id]/page.tsx`.

**Interfaces (Consumes):** T4 api-client (`listAllOrders`, `getOrder`, `updateOrderStatus`, `Order`); T5 components; `authed` (M1).

- [ ] **Step 1: Hooks** — `apps/admin/lib/orders.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getOrder, listAllOrders, updateOrderStatus, type Order, type OrderList } from '@repo/api-client';
import type { OrderStatusValue } from '@repo/types';
import { authed } from './auth-client';

const ORDERS = ['admin', 'orders'] as const;

export function useAdminOrders() {
  return useQuery<OrderList>({
    queryKey: ORDERS,
    queryFn: () => authed((o) => listAllOrders({ limit: 100 }, o)),
  });
}

export function useAdminOrder(id: string) {
  return useQuery<Order>({
    queryKey: ['admin', 'order', id],
    queryFn: () => authed((o) => getOrder(id, o)),
    enabled: Boolean(id),
  });
}

export function useOrderStatusMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: OrderStatusValue) => authed((o) => updateOrderStatus(id, status, o)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS });
      qc.invalidateQueries({ queryKey: ['admin', 'order', id] });
    },
  });
}
```

- [ ] **Step 2: Orders list page** — `apps/admin/app/orders/page.tsx`:
```tsx
'use client';

import { AdminShell } from '../_components/admin-shell';
import { OrdersTable } from '../_components/orders-table';
import { useAdminOrders } from '@/lib/orders';

export default function OrdersPage() {
  const orders = useAdminOrders();
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">Orders</h1>
      {orders.isLoading ? (
        <p className="mt-6 text-graphite">Loading…</p>
      ) : orders.isError ? (
        <p className="mt-6 text-accent">Failed to load orders.</p>
      ) : (
        <OrdersTable orders={orders.data?.items ?? []} />
      )}
    </AdminShell>
  );
}
```

- [ ] **Step 3: Order detail page** — `apps/admin/app/orders/[id]/page.tsx`:
```tsx
'use client';

import { useParams } from 'next/navigation';
import { ApiError } from '@repo/api-client';
import type { OrderStatusValue } from '@repo/types';
import { Price } from '@repo/ui';
import { AdminShell } from '../../_components/admin-shell';
import { OrderStatusControl } from '../../_components/order-status-control';
import { useAdminOrder, useOrderStatusMutation } from '@/lib/orders';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const order = useAdminOrder(id);
  const statusM = useOrderStatusMutation(id);

  if (order.isLoading) {
    return (
      <AdminShell>
        <p className="text-graphite">Loading…</p>
      </AdminShell>
    );
  }
  if (order.isError || !order.data) {
    return (
      <AdminShell>
        <p className="text-accent">Order not found.</p>
      </AdminShell>
    );
  }
  const o = order.data;
  const statusError =
    statusM.error instanceof ApiError && statusM.error.status === 409
      ? 'That status change isn’t allowed for this order anymore.'
      : statusM.isError
        ? 'Could not update status.'
        : null;

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">
        Order <span className="font-mono text-lg text-graphite">{o.id.slice(0, 8)}</span>
      </h1>
      <dl className="mt-4 grid max-w-lg grid-cols-2 gap-1 text-sm">
        <dt className="text-graphite">Customer</dt>
        <dd className="text-ink">{o.user?.email ?? '—'}</dd>
        <dt className="text-graphite">Status</dt>
        <dd className="text-ink">{o.status}</dd>
        <dt className="text-graphite">Total</dt>
        <dd>
          <Price cents={o.totalCents} currency={o.currency} />
        </dd>
        <dt className="text-graphite">Ship to</dt>
        <dd className="text-ink">
          {o.shippingName}, {o.shippingAddr}
        </dd>
      </dl>

      <table className="mt-6 w-full max-w-lg border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline text-xs uppercase tracking-wide text-graphite">
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-left">Qty</th>
            <th className="px-3 py-2 text-left">Price</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((it) => (
            <tr key={it.id} className="border-b border-hairline">
              <td className="px-3 py-2">{it.titleSnapshot}</td>
              <td className="px-3 py-2">{it.qty}</td>
              <td className="px-3 py-2">
                <Price cents={it.priceCentsSnapshot} currency={o.currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6">
        <OrderStatusControl
          status={o.status as OrderStatusValue}
          pending={statusM.isPending}
          error={statusError}
          onChange={(next) => statusM.mutate(next)}
        />
      </div>
    </AdminShell>
  );
}
```

- [ ] **Step 4: Gates** — `pnpm --filter admin test` (all admin green); `pnpm --filter admin typecheck`; `pnpm --filter admin lint`; `NODE_ENV=production pnpm --filter admin build` (routes `/orders`, `/orders/[id]` present). Reset `next-env.d.ts` before committing.

- [ ] **Step 5: Commit** — `git add apps/admin/lib/orders.ts apps/admin/app/orders && git commit -m "feat(admin): orders list + detail with status transitions"`

---

### Task 7: Pipeline + live verification

- [ ] **Step 1: Workspace pipeline** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `NODE_ENV=production pnpm build` all green; `pnpm --filter api test:e2e` green; `pnpm install --frozen-lockfile` consistent (no new deps).
- [ ] **Step 2: Restart the local API** (it serves a long-running build — restart so `/admin/users`, `/admin/stats`, and the enriched order reads are live): rebuild `pnpm --filter api build`, then restart the `node apps/api/dist/main` process; confirm `/api/v1/health` ok.
- [ ] **Step 3: API live check** — as the seeded admin: `GET /admin/users?limit=100` → 200, admin row has `orderCount` and the payload contains no `passwordHash`; `GET /admin/stats` → 200 with all five `ordersByStatus` buckets and `Σ buckets === ordersTotal`; customer token → 403 on both. Place an order via checkout, then `PATCH /admin/orders/:id/status` PENDING→PAID→SHIPPED works and an illegal jump (e.g. SHIPPED→PENDING) → 409.
- [ ] **Step 4: Admin live check** — `NODE_ENV=production pnpm --filter admin start`; unauthenticated `/orders` renders **0** order content pre-auth (RequireAdmin holds).
- [ ] **Step 5: Commit any fixes.**

---

## Definition of Done (M3)

- Admin sees every order (with customer email) and moves it through the status machine; the select offers only valid transitions and the server 409s an illegal one, surfaced as a friendly message; the change reflects in the customer's order history.
- `GET /admin/users` (paginated, `orderCount`, **no** `passwordHash`/`tokenHash`) and `GET /admin/stats` (`ordersByStatus` totals `ordersTotal`; revenue = PAID+SHIPPED+DELIVERED) are ADMIN-only, tested by e2e.
- `@repo/types` owns `userListItem`/`adminStats` and the order-transition map (server derives from it).
- `lint`/`typecheck`/`test` green across the workspace; API e2e green; `NODE_ENV=production pnpm build` green; frozen-lockfile consistent.
- Users table UI, dashboard, and Playwright admin E2E land in M4.

---

## Self-Review

- **Spec coverage:** §2 M3 row (orders UI + status change; new `/admin/users`, `/admin/stats`; contracts in `@repo/types`; api-client) → T1–T6. §4 (both endpoints ADMIN-guarded; `orderCount` via relation-count; no `passwordHash`; revenue = PAID/SHIPPED/DELIVERED; aggregates) → T2. §7 (status select offers only valid transitions; 409 → message + refetch via query invalidation) → T5/T6. §5 (`@repo/types` admin.ts; existing `updateOrderStatusInput` reused) → T1/T6.
- **Placeholder scan:** none — complete code or exact commands throughout. The one file-dependent step (T3 e2e assertion placement) names the exact block/tokens to match because `orders.e2e-spec.ts` content varies.
- **Type consistency:** `AdminService.listUsers/stats` (T2) ↔ `UserListItem`/`AdminStats` (T1) ↔ `listUsers`/`getAdminStats` (T4) ↔ M4 consumers. `orderTransitions`/`nextStatuses` (T1) used by API `order-status.ts` (T3) and `OrderStatusControl` (T5). Enriched `Order` (T4) consumed by `OrdersTable` (T5), order detail page (T6), and web (typecheck gate in T4). `updateOrderStatus(id, status)` already exists (M1).
- **Security:** explicit Prisma `select` on users (no secret columns); both endpoints ADMIN-guarded; e2e asserts 401/403 and absence of `passwordHash`/`tokenHash`. Server-side transition guard retained (client only hints).
- **YAGNI:** no role editing, no users UI, no dashboard, no charts (M4 / out of scope). Orders list uses `limit:100`, newest-first (no filter UI).
```
