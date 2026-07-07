# Фаза 1 — Фундамент + Backend API (детальный дизайн)

- **Дата:** 2026-07-07
- **Статус:** черновик на ревью
- **Фаза:** 1 из 4
- **Верхнеуровневый план:** `docs/superpowers/specs/2026-07-07-ecommerce-platform-roadmap.md`
- **Формат работы:** реализация полностью на мне + подробные пояснения по ключевым решениям.

---

## 1. Цель фазы

Получить **запускаемый, покрытый тестами backend API**, на который затем сядут веб, админка и мобилка.
На выходе: `docker-compose up` поднимает БД, `pnpm --filter api test` зелёный, Swagger доступен,
сиды создают демо-каталог и админа, CI проходит на PR.

### В объёме
Монорепо-фундамент; Nest API с доменом (каталог, корзина, заказы, отзывы); auth (JWT + роли);
Postgres/Prisma; MongoDB-модуль отзывов; `MockPaymentProvider`; Swagger; docker-compose; CI; сиды; тесты.

### Вне объёма (осознанно)
- Фронтенды (`web`/`admin`/`mobile`) — отдельные фазы.
- `@repo/api-client` и `@repo/ui` — создаём в Фазе 2, когда появится потребитель (YAGNI).
- Реальная интеграция Stripe — подключаем к `PaymentProvider` в фазе с checkout-UI.
- Гостевая корзина — на клиенте, в фазах фронтенда.

---

## 2. Вехи (для плана реализации)

| Веха | Состав | Готово, когда |
|---|---|---|
| **M1 — Фундамент** | pnpm workspace, Turborepo, `@repo/config` (tsconfig/eslint), `@repo/types` (скелет), скелет Nest, docker-compose (pg+mongo), CI | `pnpm i` ставит воркспейс; `GET /api/v1/health` отвечает; CI зелёный |
| **M2 — Каталог** | Prisma-схема (User/Category/Product), zod-контракты, публичное чтение + admin CRUD, пагинация/фильтры, сиды, e2e | Список/карточка товара отдаются; admin создаёт товар; e2e зелёный |
| **M3 — Auth** | register/login/refresh/logout/me, JWT access+refresh, ротация, роли, guard'ы | Полный auth-flow проходит в e2e; admin-ручки закрыты ролью |
| **M4 — Корзина+Заказы+Отзывы+Оплата** | серверная корзина, checkout в транзакции, статусы заказа, отзывы (Mongo)+агрегация, `MockPaymentProvider`, финализация Swagger | Сквозной checkout проходит; out-of-stock отдаёт 409; отзывы считают рейтинг |

---

## 3. Структура монорепо (создаётся в Фазе 1)

```
fullstack/
├─ apps/
│  └─ api/                     # Nest.js
├─ packages/
│  ├─ types/                   # @repo/types — zod-схемы + типы (единый контракт)
│  └─ config/                  # @repo/config — базовые tsconfig и eslint-config
├─ docker-compose.yml          # postgres + mongo (+ dev-профиль api)
├─ turbo.json                  # pipeline: build, lint, typecheck, test
├─ pnpm-workspace.yaml
├─ package.json                # корневой: скрипты-обёртки над turbo
├─ .gitignore
├─ .github/workflows/ci.yml
└─ docs/…
```

`apps/web`, `apps/admin`, `apps/mobile`, `packages/api-client`, `packages/ui` появятся в своих фазах.

---

## 4. Пакет `@repo/types` (единый контракт)

zod-схемы — источник правды. Из них выводятся типы (`z.infer`) и DTO для Nest.

```
packages/types/src/
├─ common.ts      # pagination (PageQuery), ErrorResponse, id-схемы
├─ auth.ts        # RegisterInput, LoginInput, AuthTokens, MeResponse
├─ category.ts    # Category, CreateCategoryInput, UpdateCategoryInput
├─ product.ts     # Product, ProductListQuery, Create/UpdateProductInput
├─ cart.ts        # Cart, AddCartItemInput, UpdateCartItemInput
├─ order.ts       # Order, OrderStatus, CreateOrderInput, UpdateOrderStatusInput
├─ review.ts      # Review, CreateReviewInput, ProductRating
└─ index.ts
```

Пример:
```ts
// product.ts
export const productListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().uuid().optional(),
  q: z.string().trim().min(1).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
});
export type ProductListQuery = z.infer<typeof productListQuery>;
```

Nest использует эти же схемы через `nestjs-zod` (`createZodDto`) — одна схема обслуживает
валидацию, типизацию и генерацию OpenAPI. Клиенты в следующих фазах импортируют типы отсюда.

---

## 5. Архитектура Nest (`apps/api`)

### 5.1. Модули
```
src/
├─ main.ts                     # bootstrap: helmet, cors, cookie-parser, swagger, global pipe/filter
├─ app.module.ts
├─ config/                     # ConfigModule + zod-валидация env
├─ prisma/                     # PrismaModule, PrismaService
├─ common/
│  ├─ zod-validation.pipe.ts   # (из nestjs-zod)
│  ├─ all-exceptions.filter.ts # единый формат ошибки
│  ├─ guards/ (jwt-auth, roles) + decorators/ (@Roles, @CurrentUser)
│  └─ dto/ pagination helpers
├─ health/                     # GET /health
├─ auth/                       # AuthModule (+ Jwt strategies, TokenService)
├─ users/                      # UsersModule, UsersService
├─ categories/                 # CategoriesModule
├─ products/                   # ProductsModule
├─ cart/                       # CartModule
├─ orders/                     # OrdersModule (+ PaymentModule)
├─ payment/                    # PaymentProvider, MockPaymentProvider
└─ reviews/                    # ReviewsModule (Mongoose)
```

### 5.2. Глобальные настройки
- **Префикс/версия:** `app.setGlobalPrefix('api/v1')`.
- **Валидация:** глобальный `ZodValidationPipe` (nestjs-zod) — тело/квери/параметры по zod-схемам.
- **Ошибки:** `AllExceptionsFilter` → `{ statusCode, message, errors? }`. Для zod — `errors` с полями.
- **OpenAPI:** `patchNestJsSwagger()` + `SwaggerModule`, доступ `/api/v1/docs`.
- **Безопасность:** `helmet`, `@nestjs/throttler` (лимит на `/auth/*`), CORS-allowlist из env, `cookie-parser`.
- **Env:** валидируется zod-схемой на старте; при ошибке — падаем с внятным сообщением.

---

## 6. Модель данных

### 6.1. Prisma (PostgreSQL)
```prisma
enum Role { CUSTOMER ADMIN }
enum OrderStatus { PENDING PAID SHIPPED DELIVERED CANCELLED }
enum PaymentStatus { PENDING PAID FAILED }

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(CUSTOMER)
  createdAt    DateTime @default(now())
  cart         Cart?
  orders       Order[]
  sessions     RefreshSession[]
}

model RefreshSession {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique          // sha256-хэш opaque refresh-токена (детерминированный → поиск по нему)
  expiresAt DateTime
  createdAt DateTime @default(now())
  @@index([userId])
}

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
  priceCents  Int                      // деньги — целые, минорные единицы
  currency    String   @default("USD")
  stock       Int      @default(0)
  images      String[]
  isActive    Boolean  @default(true)
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id])
  createdAt   DateTime @default(now())
  cartItems   CartItem[]
  orderItems  OrderItem[]
  @@index([categoryId])
}

model Cart {
  id     String     @id @default(uuid())
  userId String     @unique
  user   User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  items  CartItem[]
}

model CartItem {
  id        String  @id @default(uuid())
  cartId    String
  cart      Cart    @relation(fields: [cartId], references: [id], onDelete: Cascade)
  productId String
  product   Product @relation(fields: [productId], references: [id])
  qty       Int
  @@unique([cartId, productId])
}

model Order {
  id           String      @id @default(uuid())
  userId       String
  user         User        @relation(fields: [userId], references: [id])
  status       OrderStatus @default(PENDING)
  totalCents   Int
  currency     String      @default("USD")
  shippingName String
  shippingAddr String
  createdAt    DateTime    @default(now())
  items        OrderItem[]
  payment      Payment?
  @@index([userId])
}

model OrderItem {
  id                 String  @id @default(uuid())
  orderId            String
  order              Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId          String
  product            Product @relation(fields: [productId], references: [id])
  titleSnapshot      String  // снимок на момент заказа — история не «плывёт»
  priceCentsSnapshot Int
  qty                Int
}

model Payment {
  id          String        @id @default(uuid())
  orderId     String        @unique
  order       Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  provider    String        // "mock" | "stripe"
  providerRef String?
  status      PaymentStatus @default(PENDING)
  amountCents Int
}
```

### 6.2. MongoDB (Mongoose)
```
Review     { _id, productId(uuid str, indexed), userId, rating 1..5, title, body, createdAt }
ProductRating { _id: productId, avg: number, count: number }   // денормализованный агрегат
```
Отзыв уникален по `(productId, userId)` (один отзыв на товар от пользователя).

---

## 7. Поверхность API (v1)

Легенда доступа: 🔓 публично · 🔒 любой авторизованный · 👑 только admin.

| Метод | Путь | Дост. | Назначение |
|---|---|---|---|
| POST | `/auth/register` | 🔓 | регистрация (роль CUSTOMER), выдать токены |
| POST | `/auth/login` | 🔓 | вход, выдать токены |
| POST | `/auth/refresh` | 🔓* | обновить access по refresh (cookie или body), ротация |
| POST | `/auth/logout` | 🔒 | инвалидировать текущую refresh-сессию |
| GET | `/auth/me` | 🔒 | профиль текущего пользователя |
| GET | `/categories` | 🔓 | список категорий |
| POST/PATCH/DELETE | `/categories/:id?` | 👑 | CRUD категорий |
| GET | `/products` | 🔓 | список: фильтры + пагинация |
| GET | `/products/:slug` | 🔓 | карточка товара (+ рейтинг) |
| POST/PATCH/DELETE | `/products/:id?` | 👑 | CRUD товаров |
| GET | `/cart` | 🔒 | корзина пользователя |
| POST | `/cart/items` | 🔒 | добавить позицию |
| PATCH/DELETE | `/cart/items/:productId` | 🔒 | изменить qty / удалить |
| POST | `/orders` | 🔒 | checkout из корзины |
| GET | `/orders` | 🔒 | мои заказы |
| GET | `/orders/:id` | 🔒 | мой заказ (или любой для 👑) |
| GET | `/admin/orders` | 👑 | все заказы |
| PATCH | `/admin/orders/:id/status` | 👑 | сменить статус |
| GET | `/products/:productId/reviews` | 🔓 | отзывы товара |
| POST | `/products/:productId/reviews` | 🔒 | оставить отзыв |

`*` refresh не требует access-токена, но требует валидный refresh.

**Конверт списков:** `{ items, total, page, limit }`.

---

## 8. Ключевая бизнес-логика (детально — реализую я)

### 8.1. Checkout (`OrdersService.checkout`) — интерактивная Prisma-транзакция
```
prisma.$transaction(async (tx) => {
  1. cart = tx.cart(userId) с items+product;  пусто → 400.
  2. Для каждой позиции: product.isActive и stock >= qty; иначе → 409 OUT_OF_STOCK(productId).
  3. total = Σ product.priceCents * qty.
  4. order = создать (PENDING, total, shipping).
  5. orderItems = создать со снимком title/priceCents.
  6. Списать сток защищённо (от гонок / oversell):
       res = tx.product.updateMany({ where:{ id, stock:{ gte: qty } }, data:{ stock:{ decrement: qty } } });
       если res.count !== 1 → throw 409 (кто-то опередил).
  7. payment = PaymentProvider.createIntent(order) → Mock отдаёт PAID сразу;
       записать Payment, перевести order в PAID.
  8. Очистить корзину.
  9. return order с items.
});
```
**Почему так:** атомарность (всё или ничего) + защищённый декремент через условный `updateMany`
исключают продажу большего, чем есть, даже при параллельных checkout'ах.

### 8.2. Машина статусов заказа
Разрешённые переходы: `PENDING→{PAID,CANCELLED}`, `PAID→{SHIPPED,CANCELLED}`,
`SHIPPED→{DELIVERED}`, `DELIVERED`/`CANCELLED` — терминальные. Недопустимый переход → 409.

### 8.3. Отзывы и агрегат рейтинга
При создании отзыва инкрементально обновляем `ProductRating`:
`avg' = (avg*count + rating) / (count+1); count' = count+1` (upsert). Чтение карточки товара
подмешивает `{ avg, count }`. Инкремент дешевле полного пересчёта на каждый показ.

### 8.4. Refresh-токены и ротация
`login/register`: сгенерировать access (JWT ~15м) + refresh — **opaque случайную строку** (~7д);
сохранить её **sha256-хэш** (детерминированный) в `RefreshSession`. `refresh`: найти сессию по
sha256 предъявленного токена; истекла/нет → 401; иначе выдать новую пару и заменить сессию (ротация).
`logout`: удалить сессию. **Пароли — argon2** (низкоэнтропийные, солёный медленный хэш),
**refresh-токены — sha256** (высокоэнтропийные случайные, нужен поиск по хэшу).

---

## 9. Платежи (абстракция)

```ts
interface PaymentProvider {
  createIntent(order: Order): Promise<{ providerRef: string; status: PaymentStatus }>;
  handleWebhook?(payload: unknown, sig: string): Promise<void>;
}
```
Фаза 1: `MockPaymentProvider` — сразу `PAID`, без ключей и сети. `StripeProvider` подключается
позже той же точкой расширения (провайдер выбирается по env `PAYMENT_PROVIDER`).

---

## 10. Тестирование

- **Unit (Jest):** `checkout` (сумма, снимок, out-of-stock, защита от oversell), переходы статусов,
  `AuthService` (хэш, ротация, невалидный refresh), агрегация рейтинга.
- **e2e (supertest):** auth-flow (register→me→refresh→logout), products (публичное чтение vs 👑 CRUD,
  403 без роли), checkout happy-path + 409 out-of-stock, отзывы.
- **Тестовые БД:** отдельные Postgres/Mongo (docker-compose services в CI, `.env.test` локально);
  между тестами — truncate/reset.
- **Приоритет:** ветвящаяся бизнес-логика, а не геттеры.

---

## 11. DevOps

- **docker-compose.yml:** `postgres:16`, `mongo:7` с volume и healthcheck; dev-профиль для `api`.
- **Dockerfile (api):** многостадийный (deps → build → `node:slim` runtime), `prisma generate`,
  миграции при старте контейнера.
- **.env.example:** `DATABASE_URL`, `MONGO_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
  `ACCESS_TTL`, `REFRESH_TTL`, `CORS_ORIGINS`, `PAYMENT_PROVIDER`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- **CI (`.github/workflows/ci.yml`):** на PR — pnpm install (кэш) → lint → typecheck →
  test (services: postgres+mongo) → build. Turbo кэширует задачи.

---

## 12. Сиды
Идемпотентный сид: админ из `ADMIN_EMAIL/PASSWORD`, 3–4 категории, ~12 товаров, пара отзывов —
чтобы фронтенды следующих фаз сразу имели данные.

---

## 13. Журнал решений (Фаза 1)

| # | Решение | Обоснование |
|---|---|---|
| 1 | `nestjs-zod` (createZodDto) | Одна zod-схема → валидация + типы + OpenAPI |
| 2 | Access = Bearer, refresh = cookie/body + ротация | Гибрид под веб и RN; хэш в БД даёт logout/инвалидaцию |
| 3 | Защищённый декремент стока в транзакции | Исключить oversell при гонках |
| 4 | Снимок цены/названия в `OrderItem` | История заказа не меняется вслед за товаром |
| 5 | Инкрементальный агрегат рейтинга в Mongo | Дешевле полного пересчёта на чтении |
| 6 | `api-client`/`ui` отложены до Фазы 2 | YAGNI: строим, когда есть потребитель |
| 7 | Оплата в Фазе 1 — только Mock | Настоящий Stripe — когда будет checkout-UI |

---

## 14. Открытые вопросы
1. **Инструмент миграций тест-БД в CI:** сервисы docker в Actions (предлагаю) vs Testcontainers.
2. **Reuse-detection refresh-токенов:** простая ротация (предлагаю для Фазы 1) vs отзыв всех сессий при повторном использовании старого токена.
3. **Поиск товаров:** `ILIKE` по title (предлагаю для Фазы 1) vs полнотекстовый индекс Postgres (позже).
