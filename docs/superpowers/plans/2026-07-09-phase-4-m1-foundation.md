# Phase 4 · M1 — Mobile Foundation + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/mobile` — an Expo (SDK 52) + Expo Router app that bundles for web, with tab/stack navigation, an auth layer (access-JWT in memory + refresh in SecureStore, silent refresh, 401→refresh→retry), login/register screens, a Jest+RNTL test harness, and a Playwright (Expo Web) config — so M2–M4 add catalog, cart/checkout, and orders.

**Architecture:** Expo Router (file-based, `app/`) over React Navigation; web target via react-native-web for Playwright. Reuses `@repo/types` (dist) and `@repo/api-client` (src, transpiled by Metro/Babel) — **no changes to either**. A thin `lib/api.ts` supplies `baseUrl` (`EXPO_PUBLIC_API_URL`) and `authed()` (401→refresh→retry, refresh token from SecureStore sent in the request body). `AuthProvider` does silent refresh on mount. TanStack Query + zustand land in M2/M3.

**Tech Stack:** Expo SDK 52 (RN 0.76, React 18.3) · Expo Router 4 · react-native-web · TanStack Query 5 · react-hook-form + zod · Jest (`jest-expo`) + @testing-library/react-native · Playwright 1.61 (Expo Web).

## Global Constraints

- **Commands run in `fullstack-dev-1`** (`docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm ..."`). Host has no Node/pnpm. Git runs on the host.
- **Monorepo is `node-linker=hoisted`** (`.npmrc`) — flat `node_modules`, so Metro needs no pnpm-symlink workarounds, only monorepo `watchFolders` + `nodeModulesPaths`.
- Contracts from `@repo/types` **only**; `@repo/api-client`/`@repo/types` consumed unchanged. `@repo/types` is built to `dist` → run `pnpm --filter @repo/types build` before mobile typecheck/test/bundle if stale. `@repo/api-client` resolves to its TS `src` → Metro/Jest must transpile it (`@repo` whitelisted in `transformIgnorePatterns`).
- **API base URL:** `EXPO_PUBLIC_API_URL` (default `http://localhost:3000/api/v1`). Refresh/logout send the refresh token in the request **body** (API `readRefresh` reads `body.refreshToken`); api-client `refresh({ init: { body } })` passes it through unchanged.
- **Auth:** access-JWT in memory; refresh token in `expo-secure-store`. Silent refresh on mount; 401→refresh→retry; refresh failure → drop session.
- Expo Web dev server listens on **8081** (Metro). Ports 3001/3002/8081 are exposed from the dev container. `CORS_ORIGINS` already allows `http://localhost:8081`.
- Mirror existing app conventions where sensible; but RN uses its own primitives (`View/Text/Pressable`), **not** `@repo/ui`.
- Conventional Commits; no push/PR until the milestone is done and asked.

---

## File Structure

```
apps/mobile/
├─ package.json            # expo deps; "main": "expo-router/entry"; scripts
├─ app.json               # Expo config (scheme, web bundler metro, expo-router plugin)
├─ tsconfig.json          # extends expo/tsconfig.base + @/* paths
├─ babel.config.js        # babel-preset-expo
├─ metro.config.js        # monorepo watchFolders + nodeModulesPaths
├─ jest.config.js  jest.setup.ts
├─ playwright.config.ts   # (T6) Expo Web + api webServers
├─ .gitignore  .env.example
├─ e2e/                   # (T6) global-setup.ts, smoke.spec.ts
├─ lib/
│  ├─ auth.ts             # token holder (memory access + SecureStore refresh)
│  └─ api.ts              # baseUrl + authed(401→refresh→retry)
├─ components/
│  ├─ button.tsx          # Pressable button (+test)
│  └─ field.tsx           # labelled TextInput for forms
└─ app/
   ├─ _layout.tsx         # Providers (QueryClient + AuthProvider) + Stack
   ├─ index.tsx           # redirect → /(tabs)/shop
   ├─ _components/
   │  └─ auth-provider.tsx  # AuthProvider + useAuth (+test)
   ├─ (auth)/
   │  ├─ login.tsx        # (+test)
   │  └─ register.tsx
   └─ (tabs)/
      ├─ _layout.tsx      # Tabs: Shop · Cart · Account
      ├─ shop/index.tsx   # placeholder (M2 fills it)
      ├─ cart.tsx         # placeholder
      └─ account/index.tsx # placeholder
```

Order: scaffold + navigation (T1) → Jest/RNTL + Button (T2) → auth token layer (T3) → AuthProvider (T4) → login/register (T5) → Playwright Expo Web + smoke (T6) → pipeline + live (T7).

---

### Task 1: Expo scaffold + navigation skeleton

**Files:** Create `apps/mobile/{package.json,app.json,tsconfig.json,babel.config.js,metro.config.js,.gitignore,.env.example}` and `apps/mobile/app/{_layout.tsx,index.tsx,(tabs)/_layout.tsx,(tabs)/shop/index.tsx,(tabs)/cart.tsx,(tabs)/account/index.tsx}`. Install deps.

**Interfaces (Produces):** a web-bundlable Expo Router app with Shop/Cart/Account tabs (placeholders).

- [ ] **Step 1: package.json**
```json
{
  "name": "mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "web": "expo start --web --port 8081",
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "jest",
    "bundle:web": "expo export --platform web --output-dir dist"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.4.0",
    "@react-native-async-storage/async-storage": "2.1.0",
    "@repo/api-client": "workspace:*",
    "@repo/types": "workspace:*",
    "@tanstack/react-query": "^5.59.0",
    "expo": "~52.0.0",
    "expo-constants": "~17.0.0",
    "expo-linking": "~7.0.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-hook-form": "^7.81.0",
    "react-native": "0.76.5",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.4.0",
    "react-native-web": "~0.19.13",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@playwright/test": "^1.61.1",
    "@repo/config": "workspace:*",
    "@testing-library/react-native": "^12.8.0",
    "@types/react": "~18.3.0",
    "eslint": "^9.0.0",
    "jest": "^29.7.0",
    "jest-expo": "~52.0.0",
    "react-test-renderer": "18.3.1",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Expo config files**

`apps/mobile/app.json`:
```json
{
  "expo": {
    "name": "Measured",
    "slug": "measured-mobile",
    "scheme": "measured",
    "version": "0.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "web": { "bundler": "metro", "output": "single" },
    "plugins": ["expo-router"],
    "experiments": { "typedRoutes": false }
  }
}
```

`apps/mobile/babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
```

`apps/mobile/metro.config.js` (monorepo: watch the repo root, resolve from both node_modules):
```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
```

`apps/mobile/tsconfig.json`:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

`apps/mobile/.gitignore`:
```
node_modules/
.expo/
dist/
web-build/
test-results/
playwright-report/
*.log
```

`apps/mobile/.env.example`:
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

- [ ] **Step 3: Navigation skeleton**

`apps/mobile/app/_layout.tsx` (Providers wired in T4; for now just the Stack):
```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`apps/mobile/app/index.tsx`:
```tsx
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/shop" />;
}
```

`apps/mobile/app/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="shop/index" options={{ title: 'Shop' }} />
      <Tabs.Screen name="cart" options={{ title: 'Cart' }} />
      <Tabs.Screen name="account/index" options={{ title: 'Account' }} />
    </Tabs>
  );
}
```

`apps/mobile/app/(tabs)/shop/index.tsx`:
```tsx
import { View, Text } from 'react-native';

export default function ShopScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Shop — catalog arrives in M2</Text>
    </View>
  );
}
```

`apps/mobile/app/(tabs)/cart.tsx`:
```tsx
import { View, Text } from 'react-native';

export default function CartScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Cart — arrives in M3</Text>
    </View>
  );
}
```

`apps/mobile/app/(tabs)/account/index.tsx`:
```tsx
import { View, Text } from 'react-native';

export default function AccountScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Account — arrives in M4</Text>
    </View>
  );
}
```

- [ ] **Step 4: Install + bundle check** — `pnpm install`; build types first if stale (`pnpm --filter @repo/types build`); then bundle for web:
```
docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm --filter mobile exec expo export --platform web --output-dir /tmp/mobile-web 2>&1 | tail -20"
```
Expected: bundles successfully, writes `/tmp/mobile-web` (no red errors). Also `pnpm --filter mobile typecheck` clean.

- [ ] **Step 5: Commit** — `git add apps/mobile pnpm-lock.yaml && git commit -m "feat(mobile): Expo Router scaffold with tab navigation"`

---

### Task 2: Jest + RNTL harness + Button component

**Files:** Create `apps/mobile/jest.config.js`, `apps/mobile/jest.setup.ts`, `apps/mobile/components/button.tsx`, `apps/mobile/components/button.test.tsx`.

**Interfaces (Produces):** `function Button(props: { label: string; onPress?: () => void; disabled?: boolean }): JSX.Element;`

- [ ] **Step 1: Jest config**

`apps/mobile/jest.config.js` (jest-expo preset; whitelist RN + `@repo` for transform; map `@/`). No custom matcher setup is needed: `@testing-library/react-native` ≥12.4 auto-registers its matchers, and these tests use only core Jest matchers (`toBeTruthy`, `toHaveBeenCalled…`) plus RNTL queries.
```js
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|expo-router|expo-modules-core|@repo/.*)/)',
  ],
};
```
> `transformIgnorePatterns` whitelists `@repo/.*` so Jest transpiles `@repo/api-client`'s TS `src`. `moduleNameMapper` maps the `@/` path alias to the project root. `setupFiles` (not after-env) is enough here — the setup only installs native-module mocks, no matcher extension.

- [ ] **Step 2: jest.setup.ts** (mock native modules that RNTL can't run):
```ts
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
```

- [ ] **Step 3: Failing test** — `apps/mobile/components/button.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from './button';

describe('Button', () => {
  it('renders its label and fires onPress', () => {
    const onPress = jest.fn();
    render(<Button label="Tap me" onPress={onPress} />);
    fireEvent.press(screen.getByText('Tap me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', () => {
    const onPress = jest.fn();
    render(<Button label="Nope" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Nope'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run, verify fail** — `pnpm --filter mobile test button` → FAIL (module missing).

- [ ] **Step 5: Implement** — `apps/mobile/components/button.tsx`:
```tsx
import { Pressable, Text, type PressableProps } from 'react-native';

export function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: disabled ? '#B9C0F8' : '#2440F0',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 4,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 6: Run, verify pass** — `pnpm --filter mobile test button` → 2 pass.

- [ ] **Step 7: Commit** — `git add apps/mobile && git commit -m "test(mobile): jest-expo harness + Button component"`

---

### Task 3: auth token layer (`lib/auth.ts` + `lib/api.ts`)

**Files:** Create `apps/mobile/lib/auth.ts`, `apps/mobile/lib/api.ts`, `apps/mobile/lib/api.test.ts`.

**Interfaces (Produces):**
- `lib/auth.ts`: `getAccessToken()`, `setAccessToken(t)`, `getRefreshToken(): Promise<string|null>`, `setRefreshToken(t): Promise<void>`, `clearRefreshToken(): Promise<void>` (SecureStore-backed).
- `lib/api.ts`: `API_BASE`, `authed<T>(call: (opts:{ baseUrl:string; accessToken?:string }) => Promise<T>): Promise<T>` (401→refresh-from-SecureStore-in-body→retry).

- [ ] **Step 1: auth.ts**
```ts
import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'refresh_token';
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}
export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}
export function setRefreshToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(REFRESH_KEY, token);
}
export function clearRefreshToken(): Promise<void> {
  return SecureStore.deleteItemAsync(REFRESH_KEY);
}
```

- [ ] **Step 2: Failing test** — `apps/mobile/lib/api.test.ts`:
```ts
import { ApiError } from '@repo/api-client';

const api = {
  refresh: jest.fn(),
};
jest.mock('@repo/api-client', () => {
  const actual = jest.requireActual('@repo/api-client');
  return { ...actual, refresh: (...a: unknown[]) => api.refresh(...a) };
});

import * as SecureStore from 'expo-secure-store';
import { authed } from './api';
import { setAccessToken } from './auth';

describe('authed', () => {
  beforeEach(() => {
    api.refresh.mockReset();
    (SecureStore.getItemAsync as jest.Mock).mockReset().mockResolvedValue('stored-refresh');
    (SecureStore.setItemAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
    setAccessToken('access-1');
  });

  it('passes the access token through on success', async () => {
    const call = jest.fn(async () => 'ok');
    const out = await authed(call);
    expect(out).toBe('ok');
    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'access-1' }),
    );
  });

  it('refreshes from SecureStore and retries on 401', async () => {
    const call = jest
      .fn()
      .mockRejectedValueOnce(new ApiError(401, 'Unauthorized'))
      .mockResolvedValueOnce('recovered');
    api.refresh.mockResolvedValueOnce({ accessToken: 'access-2', refreshToken: 'refresh-2' });

    const out = await authed(call);

    expect(out).toBe('recovered');
    // refresh token was read from SecureStore and sent in the request body
    const refreshArgs = api.refresh.mock.calls[0][0];
    expect(JSON.parse(refreshArgs.init.body)).toEqual({ refreshToken: 'stored-refresh' });
    // new refresh token persisted; retry used the new access token
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refresh_token', 'refresh-2');
    expect(call).toHaveBeenLastCalledWith(expect.objectContaining({ accessToken: 'access-2' }));
  });
});
```

- [ ] **Step 3: Run, verify fail** — `pnpm --filter mobile test api` → FAIL (`./api` missing).

- [ ] **Step 4: Implement** — `apps/mobile/lib/api.ts`:
```ts
import { ApiError, refresh } from '@repo/api-client';
import {
  clearRefreshToken,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './auth';

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export async function authed<T>(
  call: (opts: { baseUrl: string; accessToken?: string }) => Promise<T>,
): Promise<T> {
  try {
    return await call({ baseUrl: API_BASE, accessToken: getAccessToken() ?? undefined });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    const rt = await getRefreshToken();
    if (!rt) throw e;
    try {
      const tokens = await refresh({ baseUrl: API_BASE, init: { body: JSON.stringify({ refreshToken: rt }) } });
      setAccessToken(tokens.accessToken);
      await setRefreshToken(tokens.refreshToken);
    } catch (refreshError) {
      setAccessToken(null);
      await clearRefreshToken();
      throw refreshError;
    }
    return call({ baseUrl: API_BASE, accessToken: getAccessToken() ?? undefined });
  }
}
```

- [ ] **Step 5: Run, verify pass** — `pnpm --filter mobile test api` → 2 pass; `pnpm --filter mobile typecheck` clean.

- [ ] **Step 6: Commit** — `git add apps/mobile && git commit -m "feat(mobile): auth token layer (SecureStore refresh + 401 retry)"`

---

### Task 4: `AuthProvider` (silent refresh)

**Files:** Create `apps/mobile/app/_components/auth-provider.tsx`, `apps/mobile/app/_components/auth-provider.test.tsx`; Modify `apps/mobile/app/_layout.tsx`.

**Interfaces (Produces):** `useAuth()` → `{ status: 'loading'|'authed'|'guest'; user: MeResponse|null; login(input): Promise<void>; register(input): Promise<void>; logout(): Promise<void> }`. Silent refresh on mount: if a SecureStore refresh token exists, `refresh`→`me`→authed; else guest. `login`/`register` store both tokens (access in memory, refresh in SecureStore) and set the user.

- [ ] **Step 1: Failing test** — `apps/mobile/app/_components/auth-provider.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const api = { refresh: jest.fn(), me: jest.fn(), login: jest.fn(), register: jest.fn(), logout: jest.fn() };
jest.mock('@repo/api-client', () => {
  const actual = jest.requireActual('@repo/api-client');
  return {
    ...actual,
    refresh: (...a: unknown[]) => api.refresh(...a),
    me: (...a: unknown[]) => api.me(...a),
    login: (...a: unknown[]) => api.login(...a),
    register: (...a: unknown[]) => api.register(...a),
    logout: (...a: unknown[]) => api.logout(...a),
  };
});

import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from './auth-provider';

function Probe() {
  const { status, user } = useAuth();
  return <Text>{status}:{user?.email ?? '-'}</Text>;
}

beforeEach(() => Object.values(api).forEach((m) => m.mockReset()));

it('authes an existing session via silent refresh', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-refresh');
  api.refresh.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
  api.me.mockResolvedValueOnce({ id: 'u1', email: 'a@x.io', role: 'CUSTOMER' });
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByText('authed:a@x.io')).toBeTruthy());
});

it('falls back to guest with no stored refresh token', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByText('guest:-')).toBeTruthy());
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter mobile test auth-provider` → FAIL.

- [ ] **Step 3: Implement** — `apps/mobile/app/_components/auth-provider.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  login as loginApi,
  logout as logoutApi,
  me as meApi,
  refresh as refreshApi,
  register as registerApi,
} from '@repo/api-client';
import type { LoginInput, MeResponse, RegisterInput } from '@repo/types';
import { API_BASE } from '@/lib/api';
import {
  clearRefreshToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/lib/auth';

type Status = 'loading' | 'authed' | 'guest';
type AuthValue = {
  status: Status;
  user: MeResponse | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);
const body = (refreshToken: string) => ({ baseUrl: API_BASE, init: { body: JSON.stringify({ refreshToken }) } });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<MeResponse | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const rt = await getRefreshToken();
      if (!rt) {
        if (active) setStatus('guest');
        return;
      }
      try {
        const tokens = await refreshApi(body(rt));
        setAccessToken(tokens.accessToken);
        await setRefreshToken(tokens.refreshToken);
        const profile = await meApi({ baseUrl: API_BASE, accessToken: tokens.accessToken });
        if (!active) return;
        setUser(profile);
        setStatus('authed');
      } catch {
        setAccessToken(null);
        await clearRefreshToken();
        if (active) setStatus('guest');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function establish(tokens: { accessToken: string; refreshToken: string }) {
    setAccessToken(tokens.accessToken);
    await setRefreshToken(tokens.refreshToken);
    const profile = await meApi({ baseUrl: API_BASE, accessToken: tokens.accessToken });
    setUser(profile);
    setStatus('authed');
  }

  const value: AuthValue = {
    status,
    user,
    login: async (input) => establish(await loginApi(input, { baseUrl: API_BASE })),
    register: async (input) => establish(await registerApi(input, { baseUrl: API_BASE })),
    logout: async () => {
      const rt = await getRefreshToken();
      await logoutApi(rt ? body(rt) : { baseUrl: API_BASE }).catch(() => undefined);
      setAccessToken(null);
      await clearRefreshToken();
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

Wire providers into `apps/mobile/app/_layout.tsx`:
```tsx
import { useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './_components/auth-provider';

export default function RootLayout() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter mobile test auth-provider` → 2 pass; `pnpm --filter mobile typecheck` clean.

- [ ] **Step 5: Commit** — `git add apps/mobile && git commit -m "feat(mobile): auth provider with silent refresh"`

---

### Task 5: login + register screens

**Files:** Create `apps/mobile/components/field.tsx`, `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/app/(auth)/login.test.tsx`.

**Interfaces (Produces):** `Field` (labelled TextInput); `/login` and `/register` screens (rhf + zod over `loginInput`/`registerInput`), calling `useAuth().login/register` then `router.replace('/(tabs)/shop')`.

- [ ] **Step 1: Field component** — `apps/mobile/components/field.tsx`:
```tsx
import { Text, TextInput, View, type TextInputProps } from 'react-native';

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: '#70707A', fontSize: 13, marginBottom: 4 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={{
          borderWidth: 1,
          borderColor: '#DAD8D1',
          borderRadius: 4,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: '#17171B',
        }}
        placeholderTextColor="#B0B0B8"
        {...props}
      />
      {error ? <Text style={{ color: '#2440F0', fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 2: Failing test** — `apps/mobile/app/(auth)/login.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const replace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace }) }));
const login = jest.fn();
jest.mock('@/app/_components/auth-provider', () => ({ useAuth: () => ({ login }) }));

import LoginScreen from './login';

beforeEach(() => {
  replace.mockReset();
  login.mockReset().mockResolvedValue(undefined);
});

it('submits credentials and navigates on success', async () => {
  render(<LoginScreen />);
  fireEvent.changeText(screen.getByLabelText(/email/i), 'user@example.com');
  fireEvent.changeText(screen.getByLabelText(/password/i), 'secret123');
  fireEvent.press(screen.getByRole('button', { name: /sign in/i }));

  await waitFor(() => expect(login).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret123' }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/(tabs)/shop'));
});

it('shows a validation error for a bad email', async () => {
  render(<LoginScreen />);
  fireEvent.changeText(screen.getByLabelText(/email/i), 'nope');
  fireEvent.changeText(screen.getByLabelText(/password/i), 'secret123');
  fireEvent.press(screen.getByRole('button', { name: /sign in/i }));

  await waitFor(() => expect(screen.getByText(/invalid|email/i)).toBeTruthy());
  expect(login).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run, verify fail** — `pnpm --filter mobile test login` → FAIL.

- [ ] **Step 4: Implement** — `apps/mobile/app/(auth)/login.tsx`:
```tsx
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { loginInput, type LoginInput } from '@repo/types';
import { ApiError } from '@repo/api-client';
import { Field } from '@/components/field';
import { Button } from '@/components/button';
import { useAuth } from '@/app/_components/auth-provider';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginInput), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values);
      router.replace('/(tabs)/shop');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sign in failed');
    }
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#17171B', marginBottom: 24 }}>Sign in</Text>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Field
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.email?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <Field
            label="Password"
            secureTextEntry
            value={field.value}
            onChangeText={field.onChange}
            error={errors.password?.message}
          />
        )}
      />
      {error ? <Text style={{ color: '#2440F0', marginBottom: 12 }}>{error}</Text> : null}
      <Button label={isSubmitting ? 'Signing in…' : 'Sign in'} onPress={onSubmit} disabled={isSubmitting} />
    </ScrollView>
  );
}
```

`apps/mobile/app/(auth)/register.tsx` (same shape, `registerInput`/`register`, title "Create account", button "Create account"):
```tsx
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { registerInput, type RegisterInput } from '@repo/types';
import { ApiError } from '@repo/api-client';
import { Field } from '@/components/field';
import { Button } from '@/components/button';
import { useAuth } from '@/app/_components/auth-provider';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerInput), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await register(values);
      router.replace('/(tabs)/shop');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sign up failed');
    }
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#17171B', marginBottom: 24 }}>Create account</Text>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={field.value} onChangeText={field.onChange} error={errors.email?.message} />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <Field label="Password" secureTextEntry value={field.value} onChangeText={field.onChange} error={errors.password?.message} />
        )}
      />
      {error ? <Text style={{ color: '#2440F0', marginBottom: 12 }}>{error}</Text> : null}
      <Button label={isSubmitting ? 'Creating…' : 'Create account'} onPress={onSubmit} disabled={isSubmitting} />
    </ScrollView>
  );
}
```

- [ ] **Step 5: Run, verify pass** — `pnpm --filter mobile test login` → 2 pass; `pnpm --filter mobile typecheck` clean.

- [ ] **Step 6: Commit** — `git add apps/mobile && git commit -m "feat(mobile): login and register screens (rhf + zod)"`

---

### Task 6: Playwright (Expo Web) config + smoke E2E

**Files:** Create `apps/mobile/playwright.config.ts`, `apps/mobile/e2e/global-setup.ts`, `apps/mobile/e2e/smoke.spec.ts`; Modify `apps/mobile/package.json` (add `test:e2e` script). `@playwright/test` is already a dev dep (T1).

- [ ] **Step 1: Add script** — in `apps/mobile/package.json` `scripts`, add: `"test:e2e": "playwright test"`.

- [ ] **Step 2: playwright.config.ts** (Expo Web on 8081; api on 3000):
```ts
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: isCI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
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
      command: 'pnpm --filter mobile exec expo start --web --port 8081',
      url: 'http://localhost:8081',
      timeout: 180_000,
      reuseExistingServer: !isCI,
    },
  ],
});
```

- [ ] **Step 3: global-setup.ts** (identical to web/admin):
```ts
import { execFileSync } from 'node:child_process';

export default function globalSetup() {
  execFileSync('pnpm', ['--filter', 'api', 'exec', 'prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
  execFileSync('pnpm', ['--filter', 'api', 'db:seed'], { stdio: 'inherit' });
}
```

- [ ] **Step 4: smoke.spec.ts** (foundation smoke: the app boots on web and the login screen renders):
```ts
import { test, expect } from '@playwright/test';

test('mobile web boots and the login screen renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText(/sign in/i).first()).toBeVisible();
});
```

- [ ] **Step 5: Run locally (in-container)** — kill any stale servers holding :3000/:8081 first (recurring env gotcha), then:
```
docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; CI=1 CORS_ORIGINS=http://localhost:8081 EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1 pnpm --filter mobile test:e2e 2>&1 | tail -25"
```
Expected: 1 passed. (Expo Web dev bundle is slow to compile the first time — the 180s webServer timeout accommodates it.)

- [ ] **Step 6: Commit** — `git add apps/mobile && git commit -m "test(mobile): Playwright Expo Web smoke E2E"`

---

### Task 7: Pipeline + live verification

- [ ] **Step 1: Workspace pipeline** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all green (mobile is picked up by turbo; `build` runs `mobile`'s `build` if defined — mobile has no `build` script, so turbo skips it, which is fine; `bundle:web` is invoked explicitly in T1). `pnpm install --frozen-lockfile` consistent.
- [ ] **Step 2: Bundle check** — `pnpm --filter mobile exec expo export --platform web --output-dir /tmp/mobile-web` succeeds (no red errors).
- [ ] **Step 3: Live check** — with the API running, `pnpm --filter mobile exec expo start --web --port 8081`; confirm `/login` returns 200 and renders the form; registering a new account navigates to the Shop tab (placeholder). Kill stale :3000/:8081 servers first if needed.
- [ ] **Step 4: Commit any fixes.**

---

## Definition of Done (M1)

- `apps/mobile` bundles for web (`expo export --platform web`); `/login` and `/register` work; silent refresh authes an existing session; 401→refresh→retry works; tab navigation (Shop/Cart/Account placeholders) renders.
- Jest + RNTL harness green (Button, api authed, AuthProvider, login screen); Playwright Expo Web smoke green.
- `lint`/`typecheck`/`test` green across the workspace; frozen-lockfile consistent. No changes to `@repo/types`/`@repo/api-client` contracts.
- Catalog, cart/checkout, and orders land in M2–M4.

---

## Self-Review

- **Spec coverage:** spec §5 M1 row (Expo scaffold, Expo Router, tab/stack nav, `lib/api.ts`+`lib/auth.ts` SecureStore, AuthProvider silent refresh, login/register, Jest+RNTL, Playwright Expo Web config) → T1–T6. §3.1 (api-client unchanged; refresh via `init.body`; baseUrl via wrapper) → T3/T4. §2 (RNTL headless + Expo Web/Playwright) → T2/T6. §8 (jest-expo, mocks) → T2.
- **Placeholder scan:** none. The T2 Jest config uses only `preset`/`setupFiles`/`moduleNameMapper`/`transformIgnorePatterns` — no custom matcher-setup key (RNTL ≥12.4 auto-registers matchers; tests use core Jest matchers), so there is no ambiguous option to get wrong.
- **Type consistency:** `authed({baseUrl,accessToken})` (T3) matches `api-client` `RequestOptions` (has `baseUrl`,`accessToken`,`init`). `AuthProvider.login/register` call `loginApi/registerApi(input,{baseUrl})` returning `AuthTokens`, then `meApi({baseUrl,accessToken})` → `MeResponse`. `useAuth` shape consumed by login/register screens (T5). `refresh({baseUrl,init:{body}})` — api-client `refresh` spreads `opts.init`, preserving `body`.
- **YAGNI:** no catalog/cart/orders/state in M1 (placeholders only); TanStack Query client is created but only exercised in M2; zustand added to deps but used in M3.
