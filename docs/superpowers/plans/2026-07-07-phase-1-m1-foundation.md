# Phase 1 · Milestone M1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo foundation and a runnable, tested Nest.js API skeleton (health endpoint, validated env, Postgres+Mongo wiring, green CI).

**Architecture:** pnpm + Turborepo monorepo. Internal packages (`@repo/config`, `@repo/types`) compile to `dist/` and are consumed as built JS + d.ts; Turbo builds dependencies first via `dependsOn: ["^build"]`. The Nest app (`apps/api`) mounts everything under `/api/v1`, validates input with zod (via `nestjs-zod`), and returns a single error shape.

**Tech Stack:** TypeScript, pnpm 9, Turborepo 2, NestJS 11, Prisma 6 (Postgres), Mongoose 8 (MongoDB), zod 3, nestjs-zod 4, Jest + supertest, Vitest, Docker Compose, GitHub Actions.

## Global Constraints

Every task inherits these project-wide rules (exact values):

- **Runtimes:** Node `>=20`, pnpm `>=9`. Package manager pinned in root `package.json` (`packageManager`).
- **Language:** TypeScript everywhere; `strict: true`.
- **Monorepo:** workspaces = `apps/*`, `packages/*`. Internal deps referenced as `workspace:*`. Task ordering via Turbo `^build`.
- **API surface:** all routes under global prefix `api/v1`. Swagger UI at `api/v1/docs`.
- **Contracts:** zod schemas in `@repo/types` are the single source of truth; Nest bridges them with `nestjs-zod` (`createZodDto` + global `ZodValidationPipe`).
- **Error shape:** every error response is `{ statusCode: number, message: string, errors?: Record<string,string[]> }`.
- **Money:** integer minor units (cents) only — never floats. (Not exercised in M1; enforced from M2.)
- **Secrets/crypto:** passwords → argon2; refresh tokens → sha256. (Not exercised in M1.)
- **Neutral framing:** no references to any job posting/agency in code, docs, or commit messages.
- **Process:** TDD (test-first for logic); small commits. Every commit message ends with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## Execution Environment — Docker-only local dev (adaptation 2026-07-07)

The host has only Node 12 (EOL) and no pnpm. Decision: **all Node/pnpm/Prisma/Nest commands run inside a `node:22` container**, never on the host. Only `git` and `docker`/`docker compose` run on the host.

**Command rule:** wherever a step says `pnpm …`, `node …`, `prisma …`, or `nest …`, run it as `docker compose exec dev <that command>`. Host-level steps (`git …`, file creation, `docker compose …`) run normally. Example: `docker compose exec dev pnpm install`.

**Task 0 (prerequisite to Task 1) — bring up the dev environment.** Create `docker-compose.yml` and `.npmrc` on the host, then `docker compose up -d`. This **supersedes the compose file described in Task 5** — Task 5 keeps only its Prisma/Mongoose wiring, and its verification becomes running the health e2e inside the container (a passing e2e proves both DB connections via Prisma `$connect` on init).

`.npmrc` (host, repo root):
```
node-linker=hoisted
```

`docker-compose.yml` (host, repo root):
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: shop
      POSTGRES_PASSWORD: shop
      POSTGRES_DB: shop
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shop"]
      interval: 5s
      timeout: 5s
      retries: 10
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: ["mongodata:/data/db"]
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      timeout: 5s
      retries: 10
  dev:
    image: node:22-bookworm   # full image (not -slim): ships openssl so Prisma's engine detects libssl cleanly
    working_dir: /app
    command: sh -c "corepack enable && sleep infinity"
    ports: ["3000:3000"]
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://shop:shop@postgres:5432/shop
      MONGO_URL: mongodb://mongo:27017/shop
      JWT_ACCESS_SECRET: dev_access_secret_not_for_production_0123456789
      JWT_REFRESH_SECRET: dev_refresh_secret_not_for_production_0123456789
      CORS_ORIGINS: http://localhost:3001,http://localhost:3002
    depends_on:
      postgres: { condition: service_healthy }
      mongo: { condition: service_healthy }
    volumes:
      - .:/app
      - node_modules:/app/node_modules
      - pnpm_store:/root/.local/share/pnpm
volumes:
  pgdata:
  mongodata:
  node_modules:
  pnpm_store:
```

Bring up + verify toolchain:
```bash
docker compose up -d
docker compose exec dev node -v      # expect v22.x
docker compose exec dev pnpm -v      # expect 9.x (corepack)
```

CI is unaffected: GitHub Actions uses the runner's native Node 20 via `setup-node` (Task 6). The Docker-dev workflow is local only. `.npmrc`'s `hoisted` linker applies in CI too (works fine there).

---

## File Structure (created by M1)

```
pnpm-workspace.yaml            # workspace globs
package.json                   # root: turbo script wrappers, packageManager pin
turbo.json                     # build/lint/typecheck/test/dev tasks
.nvmrc                         # 20
.github/workflows/ci.yml       # install → generate → lint → typecheck → test → build
docker-compose.yml             # postgres:16 + mongo:7 with healthchecks

packages/config/
  package.json                 # @repo/config — shared tsconfig + eslint (no build)
  tsconfig.base.json
  eslint.config.mjs

packages/types/
  package.json                 # @repo/types — compiled to dist/
  tsconfig.json
  src/common.ts                # pageQuery, Paginated<T>, errorResponse
  src/common.test.ts           # vitest
  src/index.ts

apps/api/
  package.json
  nest-cli.json
  tsconfig.json / tsconfig.build.json
  prisma/schema.prisma         # datasource + generator only (models land in M2)
  src/main.ts                  # bootstrap: prefix, helmet, cors, cookies, swagger, global pipe/filter
  src/app.module.ts
  src/common/all-exceptions.filter.ts
  src/config/env.schema.ts     # zod env schema + validateEnv
  src/config/env.schema.spec.ts
  src/config/config.module.ts
  src/prisma/prisma.service.ts
  src/prisma/prisma.module.ts
  src/health/health.controller.ts
  src/health/health.module.ts
  test/health.e2e-spec.ts
  test/jest-e2e.json
```

---

## Task 1: Monorepo skeleton (`pnpm` + Turborepo + `@repo/config`)

**Files:**
- Modify: `package.json` (overwrite the placeholder root)
- Create: `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`
- Create: `packages/config/package.json`, `packages/config/tsconfig.base.json`, `packages/config/eslint.config.mjs`
- Delete: `index.js` (leftover scaffold placeholder)

**Interfaces:**
- Produces: `@repo/config` exposing `@repo/config/tsconfig.base.json` and `@repo/config/eslint`; root scripts `build|lint|typecheck|test|dev` delegating to Turbo.

- [ ] **Step 1: Write workspace + root config files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`.nvmrc`:
```
20
```

`package.json` (overwrite):
```json
{
  "name": "fullstack",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "dev": "turbo run dev"
  },
  "devDependencies": { "turbo": "^2.1.0" }
}
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

- [ ] **Step 2: Write the `@repo/config` package**

`packages/config/package.json`:
```json
{
  "name": "@repo/config",
  "version": "0.0.0",
  "private": true,
  "files": ["tsconfig.base.json", "eslint.config.mjs"],
  "exports": {
    "./tsconfig.base.json": "./tsconfig.base.json",
    "./eslint": "./eslint.config.mjs"
  },
  "devDependencies": {
    "eslint": "^9.12.0",
    "typescript-eslint": "^8.8.0"
  }
}
```

`packages/config/tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node"
  }
}
```

`packages/config/eslint.config.mjs`:
```js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', '.next/**', 'node_modules/**', 'coverage/**'] },
  ...tseslint.configs.recommended,
);
```

- [ ] **Step 3: Remove the placeholder and install**

Run:
```bash
rm -f index.js
corepack enable
pnpm install
```
Expected: pnpm resolves the workspace; `node_modules/` created; no errors. `turbo` is available.

- [ ] **Step 4: Verify Turbo runs (no tasks yet is OK)**

Run: `pnpm exec turbo run build`
Expected: Turbo runs and reports no packages with a `build` task yet (exit 0). This confirms wiring.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm + turborepo workspace and shared config"
```

---

## Task 2: `@repo/types` package with common schemas (TDD)

**Files:**
- Create: `packages/types/package.json`, `packages/types/tsconfig.json`
- Create: `packages/types/src/common.ts`, `packages/types/src/index.ts`
- Test: `packages/types/src/common.test.ts`

**Interfaces:**
- Consumes: `@repo/config/tsconfig.base.json`.
- Produces: `@repo/types` (compiled to `dist/`) exporting `pageQuery` (zod), `PageQuery` (type), `Paginated<T>` (interface), `errorResponse` (zod), `ErrorResponse` (type).

- [ ] **Step 1: Write package + tsconfig**

`packages/types/package.json`:
```json
{
  "name": "@repo/types",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": {
    "@repo/config": "workspace:*",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/types/tsconfig.json`:
```json
{
  "extends": "@repo/config/tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "dist"]
}
```

`packages/types/eslint.config.mjs`:
```js
export { default } from '@repo/config/eslint';
```

- [ ] **Step 2: Write the failing test**

`packages/types/src/common.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pageQuery } from './common';

describe('pageQuery', () => {
  it('applies defaults', () => {
    expect(pageQuery.parse({})).toEqual({ page: 1, limit: 20 });
  });
  it('coerces string numbers from query strings', () => {
    expect(pageQuery.parse({ page: '3', limit: '50' })).toEqual({ page: 3, limit: 50 });
  });
  it('rejects a limit above 100', () => {
    expect(() => pageQuery.parse({ limit: '500' })).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @repo/types test`
Expected: FAIL — `Cannot find module './common'` (file not created yet).

- [ ] **Step 4: Implement `common.ts` and `index.ts`**

`packages/types/src/common.ts`:
```ts
import { z } from 'zod';

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof pageQuery>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export const errorResponse = z.object({
  statusCode: z.number(),
  message: z.string(),
  errors: z.record(z.array(z.string())).optional(),
});
export type ErrorResponse = z.infer<typeof errorResponse>;
```

`packages/types/src/index.ts`:
```ts
export * from './common';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @repo/types test`
Expected: PASS (3 tests).

- [ ] **Step 6: Verify build + typecheck**

Run: `pnpm --filter @repo/types build && pnpm --filter @repo/types typecheck`
Expected: `dist/index.js` + `dist/index.d.ts` produced; no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(types): add shared pagination and error contracts"
```

---

## Task 3: Nest `apps/api` skeleton + global setup + health endpoint (TDD e2e)

**Files:**
- Create: `apps/api/package.json`, `apps/api/nest-cli.json`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, `apps/api/eslint.config.mjs`
- Create: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- Create: `apps/api/src/common/all-exceptions.filter.ts`
- Create: `apps/api/src/health/health.controller.ts`, `apps/api/src/health/health.module.ts`
- Test: `apps/api/test/health.e2e-spec.ts`, `apps/api/test/jest-e2e.json`

**Interfaces:**
- Consumes: `@repo/types`.
- Produces: `AppModule`; global prefix `api/v1`; global `AllExceptionsFilter` (emits the standard error shape) and `ZodValidationPipe`; Swagger at `api/v1/docs`; `GET /api/v1/health → { status: 'ok' }`.

- [ ] **Step 1: Write package + Nest config**

`apps/api/package.json`:
```json
{
  "name": "api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "jest",
    "test:e2e": "jest --config test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/config": "^3.2.0",
    "@nestjs/swagger": "^8.0.0",
    "@repo/types": "workspace:*",
    "cookie-parser": "^1.4.7",
    "helmet": "^8.0.0",
    "nestjs-zod": "^4.0.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@repo/config": "workspace:*",
    "@types/cookie-parser": "^1.4.7",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.0",
    "typescript": "^5.6.0"
  }
}
```
> If a pinned minor is unavailable, install the current same-major release: `pnpm --filter api add <pkg>@<major>`.

`apps/api/nest-cli.json`:
```json
{ "$schema": "https://json.schemastore.org/nest-cli", "collection": "@nestjs/schematics", "sourceRoot": "src" }
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "@repo/config/tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "outDir": "dist",
    "baseUrl": "."
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

`apps/api/tsconfig.build.json`:
```json
{ "extends": "./tsconfig.json", "exclude": ["test", "dist", "**/*.spec.ts", "**/*.e2e-spec.ts"] }
```

`apps/api/eslint.config.mjs`:
```js
export { default } from '@repo/config/eslint';
```

- [ ] **Step 2: Configure Jest (unit + e2e) and install**

Add to `apps/api/package.json` a `jest` block for unit tests:
```json
"jest": {
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.ts$": "ts-jest" },
  "testEnvironment": "node"
}
```

`apps/api/test/jest-e2e.json`:
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.ts$": "ts-jest" }
}
```

Run: `pnpm install`
Expected: `api` dependencies installed.

- [ ] **Step 3: Write the failing e2e test**

`apps/api/test/health.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/v1/health -> 200 { status: "ok" }', () =>
    request(app.getHttpServer()).get('/api/v1/health').expect(200).expect({ status: 'ok' }));

  it('unknown route -> 404 with standard error shape', () =>
    request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .expect(404)
      .expect((res) => {
        if (typeof res.body.statusCode !== 'number' || typeof res.body.message !== 'string') {
          throw new Error(`unexpected error shape: ${JSON.stringify(res.body)}`);
        }
      }));
});
```

- [ ] **Step 4: Run e2e to verify it fails**

Run: `pnpm --filter api test:e2e`
Expected: FAIL — cannot find `../src/app.module` / `AllExceptionsFilter`.

- [ ] **Step 5: Implement the exception filter, health module, app module, bootstrap**

`apps/api/src/common/all-exceptions.filter.ts`:
```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    const message =
      typeof body === 'string' ? body : ((body as Record<string, unknown>).message as string) ?? 'Error';
    const errors = typeof body === 'object' ? (body as Record<string, unknown>).errors : undefined;

    res.status(status).json({ statusCode: status, message, ...(errors ? { errors } : {}) });
  }
}
```

`apps/api/src/health/health.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
```

`apps/api/src/health/health.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

`apps/api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';

@Module({ imports: [HealthModule] })
export class AppModule {}
```

`apps/api/src/main.ts`:
```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { patchNestJsSwagger, ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());

  patchNestJsSwagger();
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Shop API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
```

- [ ] **Step 6: Run e2e to verify it passes**

Run: `pnpm --filter api test:e2e`
Expected: PASS (2 tests).

- [ ] **Step 7: Verify build + typecheck**

Run: `pnpm --filter api build && pnpm --filter api typecheck`
Expected: `apps/api/dist/main.js` produced; no type errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(api): add nest skeleton with health endpoint and global error shape"
```

---

## Task 4: Validated env + config module (TDD)

**Files:**
- Create: `apps/api/src/config/env.schema.ts`, `apps/api/src/config/config.module.ts`
- Create: `.env.example`
- Modify: `apps/api/src/app.module.ts` (import `AppConfigModule`)
- Test: `apps/api/src/config/env.schema.spec.ts`

**Interfaces:**
- Produces: `envSchema` (zod), `Env` (type), `validateEnv(config) => Env`, `AppConfigModule` (global `ConfigModule` with `validate`).

- [ ] **Step 1: Write the failing unit test**

`apps/api/src/config/env.schema.spec.ts`:
```ts
import { validateEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://shop:shop@localhost:5432/shop',
  MONGO_URL: 'mongodb://localhost:27017/shop',
  JWT_ACCESS_SECRET: 'a'.repeat(16),
  JWT_REFRESH_SECRET: 'b'.repeat(16),
};

describe('validateEnv', () => {
  it('parses a valid env and fills defaults', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.PAYMENT_PROVIDER).toBe('mock');
    expect(env.NODE_ENV).toBe('development');
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omit, ...rest } = base;
    expect(() => validateEnv(rest)).toThrow(/Invalid environment/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test`
Expected: FAIL — cannot find `./env.schema`.

- [ ] **Step 3: Implement env schema + config module**

`apps/api/src/config/env.schema.ts`:
```ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().url(),
  MONGO_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL: z.string().default('7d'),
  CORS_ORIGINS: z.string().default(''),
  PAYMENT_PROVIDER: z.enum(['mock', 'stripe']).default('mock'),
  ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  ADMIN_PASSWORD: z.string().min(8).default('admin12345'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    );
  }
  return parsed.data;
}
```

`apps/api/src/config/config.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
})
export class AppConfigModule {}
```

- [ ] **Step 4: Wire it into `AppModule`**

`apps/api/src/app.module.ts` (replace file):
```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [AppConfigModule, HealthModule] })
export class AppModule {}
```

- [ ] **Step 5: Write `.env.example`**

`.env.example`:
```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://shop:shop@localhost:5432/shop
MONGO_URL=mongodb://localhost:27017/shop
JWT_ACCESS_SECRET=CHANGE_ME_generate_a_32plus_char_access_secret
JWT_REFRESH_SECRET=CHANGE_ME_generate_a_32plus_char_refresh_secret
ACCESS_TTL=15m
REFRESH_TTL=7d
CORS_ORIGINS=http://localhost:3001,http://localhost:3002
PAYMENT_PROVIDER=mock
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin12345
```

- [ ] **Step 6: Run tests + e2e to verify green**

Run (in the dev container, where DB + JWT env are already set): `docker compose exec dev pnpm --filter api test && docker compose exec dev pnpm --filter api test:e2e`
Expected: unit test PASS (2). e2e still PASS (2) — `AppModule` boots with valid env.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): validate environment variables with zod at boot"
```

---

## Task 5: Datastores — Docker Compose + Prisma + Mongoose wiring

**Files:**
- Create: `docker-compose.yml`
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma.module.ts`
- Modify: `apps/api/package.json` (add `@prisma/client`, `prisma`, `@nestjs/mongoose`, `mongoose`; add `prisma` scripts)
- Modify: `apps/api/src/app.module.ts` (import `PrismaModule` + `MongooseModule.forRootAsync`)

**Interfaces:**
- Produces: `PrismaService` (extends `PrismaClient`, connects on init) exported from global `PrismaModule`; a live Mongoose connection configured from `MONGO_URL`. M2+ inject `PrismaService`; M4 registers Mongoose schemas.

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: shop
      POSTGRES_PASSWORD: shop
      POSTGRES_DB: shop
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shop"]
      interval: 5s
      timeout: 5s
      retries: 10
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: ["mongodata:/data/db"]
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      timeout: 5s
      retries: 10
volumes:
  pgdata:
  mongodata:
```

- [ ] **Step 2: Start the datastores**

Run: `docker compose up -d && docker compose ps`
Expected: both `postgres` and `mongo` reach `healthy`.

- [ ] **Step 3: Add Prisma + Mongoose deps and scripts**

Run:
```bash
pnpm --filter api add @prisma/client @nestjs/mongoose mongoose
pnpm --filter api add -D prisma
```
Add to `apps/api/package.json` scripts:
```json
"prisma:generate": "prisma generate",
"prisma:migrate": "prisma migrate dev",
"prisma:deploy": "prisma migrate deploy"
```

- [ ] **Step 4: Write the Prisma schema (datasource + generator only)**

`apps/api/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Run: `pnpm --filter api exec prisma generate`
Expected: `@prisma/client` generated (no models yet — that is expected; models arrive in M2).

- [ ] **Step 5: Implement `PrismaService` + `PrismaModule`**

`apps/api/src/prisma/prisma.service.ts`:
```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

`apps/api/src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

- [ ] **Step 6: Wire Prisma + Mongoose into `AppModule`**

`apps/api/src/app.module.ts` (replace file):
```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ uri: config.getOrThrow<string>('MONGO_URL') }),
    }),
    HealthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 7: Verify the app boots and connects (smoke)**

Run:
```bash
cp .env.example .env
pnpm --filter api build
node apps/api/dist/main.js &
sleep 3
curl -s localhost:3000/api/v1/health
kill %1
```
Expected: prints `{"status":"ok"}` with no Prisma/Mongo connection errors in logs.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(api): wire postgres (prisma) and mongodb (mongoose) with docker compose"
```

---

## Task 6: CI pipeline (GitHub Actions)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: root scripts `lint|typecheck|test|build`; `apps/api` `prisma:generate`.
- Produces: a PR/push gate that spins up Postgres+Mongo services and runs the full verification pipeline.

- [ ] **Step 1: Write the workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
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
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api exec prisma generate
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm --filter api test:e2e
      - run: pnpm build
```

- [ ] **Step 2: Verify the pipeline locally (same steps CI runs)**

Run (inside the dev container, DBs already up):
```bash
docker compose exec dev pnpm install --frozen-lockfile
docker compose exec dev pnpm --filter api exec prisma generate
docker compose exec dev sh -c "pnpm lint && pnpm typecheck && pnpm test && pnpm --filter api test:e2e && pnpm build"
```
Expected: all steps exit 0. The e2e boots the app against the live Postgres+Mongo, proving DB wiring.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "ci: add github actions verification pipeline"
```

- [ ] **Step 4: (Optional) Push and open a PR to see CI run**

Only if the user asks. Otherwise M1 is complete locally.

---

## Self-Review

**Spec coverage (M1 scope of the Phase 1 spec):**
- Monorepo (pnpm + Turborepo, `@repo/config`, `@repo/types`) → Tasks 1, 2. ✓
- Nest skeleton, global prefix `api/v1`, error shape, zod pipe, Swagger → Task 3. ✓
- Env validation via zod → Task 4. ✓
- Postgres/Prisma + MongoDB/Mongoose wiring, docker-compose → Task 5. ✓
- GitHub Actions CI (lint/typecheck/test/build) → Task 6. ✓
- Deferred to later M1-of-phase milestones (correctly out of M1): domain models, auth, cart, orders, reviews, payment, seeds. These are M2–M4 and get their own plans.

**Placeholder scan:** No TBD/TODO; every code step has complete content; commands include expected output. ✓

**Type consistency:** `pageQuery`/`PageQuery`, `errorResponse`/`ErrorResponse`, `validateEnv`/`Env`, `PrismaService`, `AllExceptionsFilter`, `AppConfigModule`, `AppModule` are named identically everywhere they appear across tasks. Error shape `{ statusCode, message, errors? }` matches between `errorResponse` (Task 2), `AllExceptionsFilter` (Task 3), and the e2e assertion. ✓

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-07-phase-1-m1-foundation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
