# Phase 3 · M4 — Dashboard + Users + Admin E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Phase 3 — a dashboard (stat cards + recent orders) on `/`, a users table on `/users`, and a Playwright admin E2E (login → dashboard metrics → create product → it shows in the table; change an order status) wired into CI.

**Architecture:** Pure consumption of M3's API surface (`getAdminStats`, `listUsers`, `listAllOrders`) — no API changes. Presentational `StatCards` and `UsersTable` unit-tested with RTL; thin hooks (`lib/dashboard.ts`, `lib/users.ts`) and pages wire TanStack Query to them; the dashboard reuses M3's `OrdersTable` for recent orders. A new `apps/admin` Playwright project mirrors `apps/web`'s (api + admin webServers, migrate/seed global-setup) and a CI `admin-e2e` job mirrors `e2e` with `CORS_ORIGINS` for `:3002`.

**Tech Stack:** Next 15 App Router · React 19 · `@repo/api-client`/`@repo/ui`/`@repo/types` · TanStack Query 5 · Vitest + @testing-library/react · Playwright 1.61 · GitHub Actions.

## Global Constraints

- **Measured** dense admin layout (`@repo/ui` tokens/fonts), consistent with M1–M3. Stat cards: hairline-bordered, mono numbers, small uppercase labels; no new colors.
- No API or `@repo/types`/`@repo/api-client` changes — M3 already ships `getAdminStats`, `listUsers`, `listAllOrders`, `AdminStats`, `UserListItem`, `Order`. If any is missing, stop and re-check M3 rather than redefining.
- **Revenue** is displayed from `AdminStats.revenueCents` (Σ totalCents of PAID/SHIPPED/DELIVERED per M3). Format as `$X,XXX.XX` for display; label "Revenue (paid orders)". (The platform is multi-currency per order; the summed figure is a portfolio-level approximation — displayed in `$`.)
- `UserListItem.createdAt`/`Order.createdAt` arrive as JSON strings at runtime (typed `Date`/`string`); render via `new Date(v).toLocaleDateString()`, which is safe for both.
- Testing convention (as web/M2/M3): behaviour on presentational components + Playwright E2E; thin hooks and pages covered by typecheck/build + the E2E.
- Commands in `fullstack-dev-1`. Admin prod build `NODE_ENV=production pnpm --filter admin build`. Admin E2E runs Playwright's own dev webServers (`next dev`), not the prod build. Conventional Commits; PR only when the milestone is done and asked.
- **CI lesson (Phase 2):** every browser-driving e2e job MUST set `CORS_ORIGINS` for its web origin — here `http://localhost:3002` — or the API blocks cross-origin calls and the run fails with a non-ApiError.

---

## File Structure

```
apps/admin/
├─ package.json                       # UPDATE → @playwright/test dev dep + test:e2e script
├─ playwright.config.ts               # NEW → api + admin webServers, baseURL :3002
├─ .gitignore                         # NEW → ignore test-results/ .playwright
├─ e2e/
│  ├─ global-setup.ts                 # NEW → prisma migrate deploy + db:seed
│  └─ admin.spec.ts                   # NEW → login → dashboard → create product → status change
├─ lib/
│  ├─ dashboard.ts                    # NEW → useAdminStats()
│  └─ users.ts                        # NEW → useAdminUsers()
└─ app/
   ├─ _components/
   │  ├─ stat-cards.tsx               # NEW (presentational)                     (+test)
   │  └─ users-table.tsx              # NEW (presentational)                     (+test)
   ├─ page.tsx                        # UPDATE → dashboard (StatCards + recent orders)
   └─ users/page.tsx                  # NEW → users table

.github/workflows/ci.yml              # UPDATE → add admin-e2e job
```

Order: StatCards (T1) → UsersTable (T2) → hooks + dashboard + users pages (T3) → Playwright admin E2E (T4) → CI admin-e2e job (T5) → pipeline + live + PR (T6).

---

### Task 1: `StatCards` (presentational)

**Files:** Create `apps/admin/app/_components/stat-cards.tsx`, `apps/admin/app/_components/stat-cards.test.tsx`.

**Interfaces (Produces):** `function StatCards(props: { stats: AdminStats }): JSX.Element;` — four cards (Revenue, Orders, Products, Customers) plus a status-breakdown line derived from `ordersByStatus`.

- [ ] **Step 1: Failing test** — `apps/admin/app/_components/stat-cards.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminStats } from '@repo/types';
import { StatCards } from './stat-cards';

const stats: AdminStats = {
  ordersTotal: 14,
  ordersByStatus: { PENDING: 0, PAID: 8, SHIPPED: 2, DELIVERED: 2, CANCELLED: 2 },
  revenueCents: 19400,
  productCount: 33,
  userCount: 45,
};

describe('StatCards', () => {
  it('renders the headline metrics', () => {
    render(<StatCards stats={stats} />);
    expect(screen.getByText('$194.00')).toBeInTheDocument(); // revenue
    expect(screen.getByText('14')).toBeInTheDocument(); // orders total
    expect(screen.getByText('33')).toBeInTheDocument(); // products
    expect(screen.getByText('45')).toBeInTheDocument(); // customers
  });

  it('shows the per-status breakdown', () => {
    render(<StatCards stats={stats} />);
    expect(screen.getByText(/PAID/)).toBeInTheDocument();
    // 8 PAID appears in the breakdown
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter admin test stat-cards"` → FAIL (module missing).

- [ ] **Step 3: Implement** — `apps/admin/app/_components/stat-cards.tsx`:
```tsx
'use client';

import type { AdminStats } from '@repo/types';

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-hairline bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-graphite">{label}</div>
      <div className="mt-2 font-mono text-2xl tabular-nums text-ink">{value}</div>
    </div>
  );
}

const STATUS_ORDER = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

export function StatCards({ stats }: { stats: AdminStats }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Revenue (paid orders)" value={money(stats.revenueCents)} />
        <Card label="Orders" value={String(stats.ordersTotal)} />
        <Card label="Products" value={String(stats.productCount)} />
        <Card label="Customers" value={String(stats.userCount)} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {STATUS_ORDER.map((s) => (
          <span
            key={s}
            className="rounded-sm border border-hairline px-2 py-1 font-mono text-graphite"
          >
            {s} <span className="text-ink">{stats.ordersByStatus[s]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter admin test stat-cards` → 2 pass.

- [ ] **Step 5: Commit** — `git add apps/admin/app/_components/stat-cards.tsx apps/admin/app/_components/stat-cards.test.tsx && git commit -m "feat(admin): dashboard stat cards"`

---

### Task 2: `UsersTable` (presentational)

**Files:** Create `apps/admin/app/_components/users-table.tsx`, `apps/admin/app/_components/users-table.test.tsx`.

**Interfaces (Produces):** `function UsersTable(props: { users: UserListItem[] }): JSX.Element;` — columns Email, Role, Orders, Joined; empty state.

- [ ] **Step 1: Failing test** — `apps/admin/app/_components/users-table.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UserListItem } from '@repo/types';
import { UsersTable } from './users-table';

const users: UserListItem[] = [
  {
    id: 'u1',
    email: 'admin@example.com',
    role: 'ADMIN',
    createdAt: new Date('2026-01-01'),
    orderCount: 0,
  },
  {
    id: 'u2',
    email: 'buyer@example.com',
    role: 'CUSTOMER',
    createdAt: new Date('2026-02-02'),
    orderCount: 5,
  },
];

describe('UsersTable', () => {
  it('renders a row per user with role and order count', () => {
    render(<UsersTable users={users} />);
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    expect(screen.getByText('buyer@example.com')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows an empty state', () => {
    render(<UsersTable users={[]} />);
    expect(screen.getByText(/no users/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter admin test users-table` → FAIL.

- [ ] **Step 3: Implement** — `apps/admin/app/_components/users-table.tsx`:
```tsx
'use client';

import type { UserListItem } from '@repo/types';

const cell = 'px-3 py-2 text-left align-middle';

export function UsersTable({ users }: { users: UserListItem[] }) {
  if (users.length === 0) {
    return <p className="mt-6 text-sm text-graphite">No users yet.</p>;
  }
  return (
    <table className="mt-6 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-hairline text-xs uppercase tracking-wide text-graphite">
          <th className={cell}>Email</th>
          <th className={cell}>Role</th>
          <th className={cell}>Orders</th>
          <th className={cell}>Joined</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-b border-hairline">
            <td className={cell}>{u.email}</td>
            <td className={cell}>
              <span
                className={
                  u.role === 'ADMIN'
                    ? 'font-mono text-xs text-accent'
                    : 'font-mono text-xs text-graphite'
                }
              >
                {u.role}
              </span>
            </td>
            <td className={cell}>{u.orderCount}</td>
            <td className={cell}>{new Date(u.createdAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter admin test users-table` → 2 pass.

- [ ] **Step 5: Commit** — `git add apps/admin/app/_components/users-table.tsx apps/admin/app/_components/users-table.test.tsx && git commit -m "feat(admin): users table"`

---

### Task 3: hooks + dashboard page + users page

**Files:** Create `apps/admin/lib/dashboard.ts`, `apps/admin/lib/users.ts`, `apps/admin/app/users/page.tsx`; Modify `apps/admin/app/page.tsx`.

**Interfaces (Consumes):** `getAdminStats`, `listUsers`, `listAllOrders` (api-client); `StatCards` (T1), `UsersTable` (T2), `OrdersTable` (M3); `authed` (M1).

- [ ] **Step 1: Hooks** — `apps/admin/lib/dashboard.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { getAdminStats } from '@repo/api-client';
import type { AdminStats } from '@repo/types';
import { authed } from './auth-client';

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => authed((o) => getAdminStats(o)),
  });
}
```
`apps/admin/lib/users.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { listUsers } from '@repo/api-client';
import type { Paginated, UserListItem } from '@repo/types';
import { authed } from './auth-client';

export function useAdminUsers() {
  return useQuery<Paginated<UserListItem>>({
    queryKey: ['admin', 'users'],
    queryFn: () => authed((o) => listUsers({ limit: 100 }, o)),
  });
}
```

- [ ] **Step 2: Dashboard page** — replace `apps/admin/app/page.tsx`:
```tsx
'use client';

import { AdminShell } from './_components/admin-shell';
import { StatCards } from './_components/stat-cards';
import { OrdersTable } from './_components/orders-table';
import { useAdminStats } from '@/lib/dashboard';
import { useAdminOrders } from '@/lib/orders';

export default function DashboardPage() {
  const stats = useAdminStats();
  const orders = useAdminOrders();
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>

      {stats.isLoading ? (
        <p className="mt-6 text-graphite">Loading metrics…</p>
      ) : stats.isError || !stats.data ? (
        <p className="mt-6 text-accent">Failed to load metrics.</p>
      ) : (
        <StatCards stats={stats.data} />
      )}

      <h2 className="mt-10 font-display text-lg font-semibold text-ink">Recent orders</h2>
      {orders.isLoading ? (
        <p className="mt-4 text-graphite">Loading…</p>
      ) : orders.isError ? (
        <p className="mt-4 text-accent">Failed to load orders.</p>
      ) : (
        <OrdersTable orders={(orders.data?.items ?? []).slice(0, 5)} />
      )}
    </AdminShell>
  );
}
```

- [ ] **Step 3: Users page** — `apps/admin/app/users/page.tsx`:
```tsx
'use client';

import { AdminShell } from '../_components/admin-shell';
import { UsersTable } from '../_components/users-table';
import { useAdminUsers } from '@/lib/users';

export default function UsersPage() {
  const users = useAdminUsers();
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">Users</h1>
      {users.isLoading ? (
        <p className="mt-6 text-graphite">Loading…</p>
      ) : users.isError ? (
        <p className="mt-6 text-accent">Failed to load users.</p>
      ) : (
        <UsersTable users={users.data?.items ?? []} />
      )}
    </AdminShell>
  );
}
```

- [ ] **Step 4: Gates** — `pnpm --filter admin test` (all admin green); `pnpm --filter admin typecheck`; `pnpm --filter admin lint`; `NODE_ENV=production pnpm --filter admin build` (routes `/`, `/users` present). Reset `next-env.d.ts` before committing.

- [ ] **Step 5: Commit** — `git add apps/admin/lib apps/admin/app/page.tsx apps/admin/app/users && git commit -m "feat(admin): dashboard metrics + recent orders + users page"`

---

### Task 4: Playwright admin E2E

**Files:** Create `apps/admin/playwright.config.ts`, `apps/admin/e2e/global-setup.ts`, `apps/admin/e2e/admin.spec.ts`, `apps/admin/.gitignore`; Modify `apps/admin/package.json`.

**Interfaces:** a runnable `pnpm --filter admin test:e2e` (Playwright drives api + admin).

- [ ] **Step 1: package.json** — add the script and dev dep. In `apps/admin/package.json`, add to `scripts`: `"test:e2e": "playwright test"`, and to `devDependencies`: `"@playwright/test": "^1.61.1"`. Then `pnpm install` (in-container) to link it.

- [ ] **Step 2: .gitignore** — `apps/admin/.gitignore`:
```
test-results/
playwright-report/
.playwright/
```

- [ ] **Step 3: playwright.config.ts** — `apps/admin/playwright.config.ts` (mirror web; baseURL :3002, admin dev server):
```ts
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: isCI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './e2e/global-setup.ts',
  webServer: [
    {
      command: 'pnpm --filter api start:dev',
      url: 'http://localhost:3000/api/v1/health',
      timeout: 120_000,
      reuseExistingServer: !isCI,
    },
    {
      command: 'pnpm --filter admin dev',
      url: 'http://localhost:3002/login',
      timeout: 120_000,
      reuseExistingServer: !isCI,
    },
  ],
});
```

- [ ] **Step 4: global-setup.ts** — `apps/admin/e2e/global-setup.ts` (identical to web's):
```ts
import { execFileSync } from 'node:child_process';

// Ensure the API's databases are migrated and seeded before the run.
// Commands are hardcoded (no external input) and run without a shell.
export default function globalSetup() {
  execFileSync('pnpm', ['--filter', 'api', 'exec', 'prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
  });
  execFileSync('pnpm', ['--filter', 'api', 'db:seed'], { stdio: 'inherit' });
}
```

- [ ] **Step 5: spec** — `apps/admin/e2e/admin.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'dev_admin_password_change_me';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Redirects to the dashboard on success.
  await expect(page).toHaveURL('/');
}

test('admin logs in and sees dashboard metrics', async ({ page }) => {
  await login(page);
  await expect(page.getByText(/revenue \(paid orders\)/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /recent orders/i })).toBeVisible();
});

test('admin creates a product and it appears in the table', async ({ page }) => {
  await login(page);

  const slug = `e2e-widget-${Date.now()}`;
  await page.goto('/products/new');
  await page.getByLabel(/title/i).fill('E2E Widget');
  await page.getByLabel(/slug/i).fill(slug);
  await page.getByLabel(/description/i).fill('Created by an admin E2E run');
  await page.getByLabel(/price/i).fill('3300');
  // Pick the first real category in the select.
  await page.getByLabel(/category/i).selectOption({ index: 1 });
  await page.getByRole('button', { name: /save product/i }).click();

  // Back to the products table with the new product listed.
  await expect(page).toHaveURL('/products');
  await expect(page.getByText('E2E Widget')).toBeVisible();
  await expect(page.getByText(slug)).toBeVisible();
});
```

- [ ] **Step 6: Run locally (in-container)** — the dev container has no browser; install + run headless:
  `docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter admin exec playwright install --with-deps chromium && CORS_ORIGINS=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 pnpm --filter admin test:e2e"`
  Expected: 2 passed. (If a prior dev API/admin holds :3000/:3002, Playwright reuses them locally via `reuseExistingServer: !isCI`; kill stale servers first if the manifest is out of date — see the recurring env gotcha.)

- [ ] **Step 7: Commit** — `git add apps/admin/playwright.config.ts apps/admin/e2e apps/admin/.gitignore apps/admin/package.json pnpm-lock.yaml && git commit -m "test(admin): Playwright admin E2E (login, dashboard, create product)"`

---

### Task 5: CI `admin-e2e` job

**Files:** Modify `.github/workflows/ci.yml`.

- [ ] **Step 1: Add the job** — append after the `e2e` job (same indentation level, mirrors it with the admin origin):
```yaml
  admin-e2e:
    runs-on: ubuntu-latest
    needs: verify
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: shop
          POSTGRES_PASSWORD: shop
          POSTGRES_DB: shop
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
      # The admin app (origin :3002) makes cross-origin browser requests to the API
      # (:3000); without this allowlist the API blocks them and client calls fail.
      CORS_ORIGINS: http://localhost:3002
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api exec prisma generate
      # @repo/types is consumed from its built dist by the API and the admin app.
      - run: pnpm --filter @repo/types build
      - run: pnpm --filter admin exec playwright install --with-deps chromium
      - run: pnpm --filter admin run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: admin-playwright-results
          path: apps/admin/test-results/
          retention-days: 7
```

- [ ] **Step 2: Sanity-check YAML** — confirm indentation matches the existing `e2e` job (2-space job key under `jobs:`); `admin-e2e` is a sibling of `verify` and `e2e`.

- [ ] **Step 3: Commit** — `git add .github/workflows/ci.yml && git commit -m "ci: admin Playwright e2e job"`

---

### Task 6: Pipeline + live verification + PR

- [ ] **Step 1: Workspace pipeline** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `NODE_ENV=production pnpm build` all green; `pnpm --filter api test:e2e` green; `pnpm install --frozen-lockfile` consistent (records the new `@playwright/test` dev dep in `apps/admin`).
- [ ] **Step 2: Admin live check** — ensure a fresh API is running (restart if a stale build holds :3000 — recurring env gotcha); `NODE_ENV=production pnpm --filter admin start`; log in as the seeded admin → dashboard shows the four stat cards + recent orders; `/users` lists users with role + order counts. Unauthenticated `/` and `/users` render 0 metric/user content (RequireAdmin holds).
- [ ] **Step 3: Push branch, open PR, watch CI** — push `feat/phase-3-m4-dashboard-users-e2e`; open PR; **explicitly** `gh pr checks <N>` until `verify`, `e2e`, and the new `admin-e2e` all report `pass` (not a watch exit code).
- [ ] **Step 4: Merge** — on green, `gh pr merge <N> --merge --delete-branch`; sync `main`.
- [ ] **Step 5: Update memory** — mark Phase 3 COMPLETE.

---

## Definition of Done (M4 / Phase 3)

- `/` shows a dashboard: four stat cards (revenue, orders, products, customers) + per-status breakdown + recent orders; `/users` shows a users table (email, role, order count, joined).
- A Playwright admin E2E (login → dashboard metrics → create product → appears in table) runs green locally and in a CI `admin-e2e` job (with `CORS_ORIGINS` for :3002).
- `lint`/`typecheck`/`test` green across the workspace; API e2e green; `NODE_ENV=production pnpm build` green; frozen-lockfile consistent.
- No API/contract changes (pure M3 consumption). **Phase 3 (admin panel) COMPLETE**; Phase 4 (RN mobile) remains.

---

## Self-Review

- **Spec coverage:** §2 M4 row (dashboard stat-cards + recent orders; users table; Playwright admin-E2E; CI job) → T1–T5. §9 (Playwright: login → create product → appears; against api+admin webServer array + migrate/seed global-setup) → T4. §10 (admin-e2e job with `CORS_ORIGINS`/`NEXT_PUBLIC_API_URL`) → T5. §7 route `/users` → T3.
- **Placeholder scan:** none — full code or exact commands throughout.
- **Type consistency:** `StatCards({stats: AdminStats})` (T1) ↔ `useAdminStats` (T3) ↔ `getAdminStats` (M3). `UsersTable({users: UserListItem[]})` (T2) ↔ `useAdminUsers` returns `Paginated<UserListItem>` → `.items` (T3). Dashboard reuses M3 `OrdersTable({orders: Order[]})` with `useAdminOrders().data.items` sliced. `ordersByStatus[s]` indexed by the literal `STATUS_ORDER` tuple (all valid keys).
- **No API drift:** T1–T3 consume only M3 exports; T4/T5 are test/CI only. Nothing under `apps/api`, `packages/types`, `packages/api-client` changes.
- **YAGNI:** no charts/graphs, no users pagination UI (limit:100), no CSV export, no role editing — all deferred/out of scope per the spec. Recent orders is a 5-row slice of the existing list, not a new endpoint.
```
