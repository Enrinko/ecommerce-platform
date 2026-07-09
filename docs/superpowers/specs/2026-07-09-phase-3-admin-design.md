# Фаза 3 — Админ-панель (Next.js) — детальный дизайн

- **Дата:** 2026-07-09
- **Статус:** черновик на ревью
- **Фаза:** 3 из 4
- **Верхнеуровневый план:** `docs/superpowers/specs/2026-07-07-ecommerce-platform-roadmap.md`
- **Предыдущие фазы:** Фаза 1 (backend API) и Фаза 2 (веб-витрина) — в `main`.

---

## 1. Цель фазы

Дать администратору инструмент управления магазином: **CRUD каталога, управление заказами,
список пользователей и простой дашборд** — отдельным приложением `apps/admin`, поверх того же API.
На выходе: `docker-compose up` + `pnpm --filter admin dev` поднимает админку на :3002; админ создаёт
товар → он виден на витрине; смена статуса заказа → отражается в истории покупателя; CI зелёный.

### В объёме (полный объём — согласовано)
Отдельное `apps/admin`; admin-auth (доступ только ADMIN); CRUD товаров и категорий; список всех заказов
и смена статуса (по машине состояний); **список пользователей** и **дашборд** (кол-во заказов/выручка);
**расширение API** новыми ручками `GET /admin/users` и `GET /admin/stats` (с тестами); admin-функции в
`@repo/api-client`; Playwright admin-E2E; CI на admin.

### Вне объёма (осознанно)
- Мобильное приложение (`apps/mobile`) — Фаза 4.
- Реальная аналитика/графики, экспорт, аудит-лог — точки расширения.
- Роль-менеджмент (назначение ролей через UI) — только просмотр пользователей; смена ролей вне объёма.
- Загрузка изображений товаров — поле `images[]` редактируется как список URL (загрузка файлов — позже).

---

## 2. Вехи

| Веха | Состав | Готово, когда |
|---|---|---|
| **M1 — Фундамент + auth** | каркас `apps/admin` (Next App Router, порт 3002, Measured-токены, плотная admin-оболочка + сайдбар), admin-auth (access-в-памяти + refresh + `RequireAdmin`), admin-функции каталога/заказов в `@repo/api-client`, страница login | `pnpm --filter admin dev` поднимается; не-админ не проходит; сайдбар-оболочка работает; lint/typecheck/build зелёные |
| **M2 — Каталог** | список товаров (таблица) + create/edit/delete; список категорий + CRUD; формы (rhf+zod) | админ создаёт/редактирует/удаляет товар и категорию; товар виден на витрине |
| **M3 — Заказы + API** | admin-orders UI (таблица + смена статуса); **новые** `GET /admin/users`, `GET /admin/stats` (сервисы + guard + e2e); контракты в `@repo/types`; api-client | смена статуса заказа отражается в истории покупателя; новые ручки отдают данные под 👑 |
| **M4 — Дашборд + пользователи + E2E** | дашборд (stats-карточки + свежие заказы), список пользователей; Playwright admin-E2E; CI-джоб | дашборд показывает счётчики/выручку; список пользователей; e2e (логин→создать товар→виден) зелёный |

Каждая веха: свой план в `docs/superpowers/plans/`, TDD, свой PR.

---

## 3. Структура монорепо (добавляется в Фазе 3)

```
fullstack/
├─ apps/
│  ├─ api/        # Nest.js (+ новый users/stats admin-модуль в M3)
│  ├─ web/        # Next.js витрина (Фаза 2)
│  └─ admin/      # Next.js админка (новое) — порт 3002
├─ packages/
│  ├─ types/      # @repo/types (+ userListItem, adminStats)
│  ├─ config/     # @repo/config
│  ├─ api-client/ # @repo/api-client (+ admin-функции)
│  └─ ui/         # @repo/ui (переиспользуется)
```

`apps/admin` слушает **3002** — dev-compose уже отдаёт `CORS_ORIGINS=…,http://localhost:3002`.

---

## 4. Расширения API (`apps/api`, веха M3)

Новый admin-модуль (или расширение существующих) — обе ручки за `JwtAuthGuard + RolesGuard @Roles('ADMIN')`:

- **`GET /admin/users`** (👑) — пагинированный список: `{ items: UserListItem[], total, page, limit }`,
  где `UserListItem = { id, email, role, createdAt, orderCount }`. `orderCount` — через relation-count Prisma.
  `passwordHash`/`tokenHash` **никогда** не сериализуются (явный `select`).
- **`GET /admin/stats`** (👑) — `{ ordersTotal, ordersByStatus: Record<OrderStatus, number>, revenueCents,
  productCount, userCount }`. Считается Prisma-агрегатами (`count`, `groupBy status`, `sum totalCents`).
  **Выручка = Σ `totalCents` заказов в статусах PAID, SHIPPED, DELIVERED** (оплаченные; PENDING и
  CANCELLED исключены).

Тесты (e2e supertest): 401 без токена, 403 для CUSTOMER, 200 + форма для ADMIN; `passwordHash` отсутствует
в ответе `/admin/users`.

---

## 5. Пакеты `@repo/types` и `@repo/api-client`

### `@repo/types` (M3)
```
admin.ts:
  userListItem   = { id, email, role, createdAt }  (+ orderCount)
  adminStats     = { ordersTotal, ordersByStatus, revenueCents, productCount, userCount }
```
Существующие `createProductInput`/`updateProductInput`/`createCategoryInput`/`updateCategoryInput`/
`updateOrderStatusInput` переиспользуются формами админки.

### `@repo/api-client` (M1 — каталог/заказы; M3 — users/stats)
Новые типизированные функции (все принимают `RequestOptions` с `accessToken`):
```
products:   createProduct, updateProduct, deleteProduct
categories: createCategory, updateCategory, deleteCategory
orders:     listAllOrders(query), updateOrderStatus(id, status)
admin:      listUsers(query), adminStats()         (M3)
```

---

## 6. Архитектура `apps/admin` (App Router)

Клиентоцентричная (инструмент целиком за авторизацией — серверные компоненты не имеют доступа к
in-memory access-токену, поэтому чтение и мутации идут с клиента):

- **Auth:** access-JWT в памяти (module holder + React-контекст), refresh в httpOnly-cookie (тот же
  паттерн, что в Фазе 2 M3). При загрузке — тихий refresh; на 401 — refresh-and-retry.
- **`RequireAdmin`** (client) оборачивает все страницы: `loading` → ничего; `authed && role==='ADMIN'`
  → children; иначе (гость или CUSTOMER) → редирект на `/login` (и понятное «только для админов»).
- **Данные:** TanStack Query поверх authed-клиента (списки, мутации с инвалидацией). Формы —
  react-hook-form + `@hookform/resolvers/zod` со схемами из `@repo/types`.
- **Оболочка:** постоянный левый сайдбар (Dashboard/Products/Categories/Orders/Users), топбар (email +
  logout). Токены Measured (`@repo/ui`), admin-плотность: компактные таблицы, плотные формы, малые радиусы.

### auth-client (переиспользование)
Token holder + `authed()` (401→refresh→retry) в Фазе 2 живёт в `apps/web/lib/auth-client.ts`.
Для Фазы 3 — **свой небольшой дубль в `apps/admin/lib`** (≈30 строк). Извлечение в общий пакет отложено
до появления 3-го потребителя (мобилка, Фаза 4) — YAGNI.

---

## 7. Маршруты `apps/admin`

```
app/
├─ layout.tsx              # провайдеры + AdminShell (сайдбар/топбар за RequireAdmin, кроме /login)
├─ login/page.tsx          # админ-логин (не-ADMIN отклоняется)
├─ page.tsx                # / — дашборд (stats + свежие заказы)
├─ products/
│  ├─ page.tsx             # таблица товаров
│  ├─ new/page.tsx         # создание
│  └─ [id]/edit/page.tsx   # редактирование
├─ categories/page.tsx     # таблица + inline/модальный CRUD
├─ orders/
│  ├─ page.tsx             # таблица всех заказов
│  └─ [id]/page.tsx        # детали + смена статуса
└─ users/page.tsx          # таблица пользователей
```

Смена статуса заказа: селект показывает только допустимые переходы (машина состояний Фазы 1);
недопустимый → API вернёт 409, UI покажет сообщение и рефетчит.

---

## 8. Обработка ошибок

- api-client нормализует конверт `{statusCode,message,errors?}` → `ApiError` (как в Фазе 2).
- Формы: `errors` по полям (rhf), общий `message` — тост/алерт.
- `403`/`401` → `RequireAdmin`/refresh-flow; `409` (недопустимый переход статуса, FK на удаление) →
  понятное сообщение (напр. «нельзя удалить категорию с товарами») + рефетч.
- Пустые состояния таблиц; лоадеры.

---

## 9. Тестирование

- **API (M3):** e2e для `/admin/users` и `/admin/stats` — роль/доступ, форма ответа, отсутствие
  `passwordHash`.
- **Admin (Vitest + RTL):** `RequireAdmin` (редирект гостя/не-админа), формы товара/категории (валидация),
  форматирование stats, парсинг фильтров.
- **Playwright admin-E2E (M4):** логин админом → создать товар → он появляется в таблице (и на витрине);
  сменить статус заказа. Против запущенных API+admin (webServer array + migrate/seed globalSetup).
- **CI:** admin `lint`/`typecheck`/`build`; отдельный admin-e2e джоб (с `CORS_ORIGINS=…3002`,
  `NEXT_PUBLIC_API_URL`).

---

## 10. DevOps / CI

- **Локально:** admin на 3002; API на 3000; Postgres+Mongo из compose. `.env.example` в `apps/admin`.
- **CI:** turbo автоматически подхватит admin для `lint`/`typecheck`/`test`/`build` (как web). Новый
  `admin-e2e` job (postgres+mongo, playwright install, `CORS_ORIGINS` для 3002). **Важно (урок Фазы 2):**
  e2e-джобы обязаны задавать `CORS_ORIGINS` — иначе браузерные кросс-доменные запросы блокируются.
- Локальная production-сборка admin — с `NODE_ENV=production` (dev-контейнер форсит `development`).

---

## 11. Журнал решений (Фаза 3)

| # | Решение | Обоснование |
|---|---|---|
| 1 | Отдельное `apps/admin` (не роуты в web) | Многоприложенческое монорепо, разделение ответственности (roadmap реш. №7) |
| 2 | Клиентоцентричная админка (не RSC) | Инструмент за auth; серверные компоненты не имеют in-memory токен — проще client + TanStack Query |
| 3 | Токены Measured + плотный admin-лейаут | Бренд-консистентность без ущерба плотности инструмента |
| 4 | Полный объём: +users +stats (расширить API) | Демонстрирует сквозную backend+frontend интеграцию; полный roadmap-состав |
| 5 | auth-client дублируется в admin | YAGNI; извлечение в пакет — при 3-м потребителе (мобилка) |
| 6 | Смена ролей вне объёма | Только просмотр пользователей; безопаснее и проще для фазы |

---

## 12. Потребляемая + новая поверхность API

Базовый префикс `/api/v1`. 👑 = только ADMIN.

| Область | Ручки | Статус |
|---|---|---|
| Auth | `POST /auth/login`, `/refresh`, `/logout`(🔒), `GET /auth/me`(🔒) | есть |
| Каталог (чтение) | `GET /categories`, `GET /products`, `GET /products/:slug` | есть |
| Каталог (CRUD) | `POST/PATCH/DELETE /products`, `/categories`(👑) | есть (api-client — M1) |
| Заказы | `GET /admin/orders`(👑), `PATCH /admin/orders/:id/status`(👑) | есть (api-client — M1) |
| **Пользователи** | **`GET /admin/users`(👑)** | **новое — M3** |
| **Дашборд** | **`GET /admin/stats`(👑)** | **новое — M3** |

---

## 13. Открытые вопросы
1. **Выручка в stats:** Σ `totalCents` по каким статусам? Предложение: PAID/SHIPPED/DELIVERED (оплаченные),
   исключая CANCELLED/PENDING.
2. **Пагинация users/orders в админке:** тот же конверт `{items,total,page,limit}` и `limit≤100` (как §7 Фазы 1).
3. **Редактирование ролей пользователей:** вне объёма (только просмотр) — подтвердить.
