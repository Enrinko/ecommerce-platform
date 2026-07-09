# Фаза 2 — Веб-витрина (Next.js) — детальный дизайн

- **Дата:** 2026-07-09
- **Статус:** черновик на ревью
- **Фаза:** 2 из 4
- **Верхнеуровневый план:** `docs/superpowers/specs/2026-07-07-ecommerce-platform-roadmap.md`
- **Предыдущая фаза:** `docs/superpowers/specs/2026-07-07-phase-1-foundation-backend-api-design.md` (backend API готов, M1–M4 в `main`)

---

## 1. Цель фазы

Дать покупателю сквозной путь **«каталог → товар → корзина → checkout → заказ»** в браузере,
поверх готового API Фазы 1. На выходе: `apps/web` (Next.js App Router) поднимается локально,
общается с API, проходит сквозной сценарий покупки в Playwright, адаптив mobile-first,
CI зелёный на PR.

### В объёме
Приложение `apps/web`; пакеты `@repo/api-client` (типизированный клиент) и `@repo/ui` (примитивы);
каталог с фильтрами/пагинацией/сортировкой; карточка товара с отзывами и рейтингом; авторизация
(login/register, access в памяти + refresh по cookie); гостевая корзина на клиенте с мёржем при логине;
серверная корзина после логина; checkout; история заказов; обработка ошибок; тесты (Vitest + Playwright);
CI на web.

### Вне объёма (осознанно)
- `apps/admin` и `apps/mobile` — отдельные фазы (3 и 4).
- Реальный приём денег — оплата остаётся `MockPaymentProvider` из Фазы 1.
- i18n/мультивалютность в UI — одна локаль; валюта берётся из товара (API: enum `USD|EUR|GBP`, один
  валютный вид на заказ), но переключателя валют/языка не делаем.
- SSR-кэширование/ISR-стратегии продакшн-уровня, аналитика, A/B — точки расширения, не критерий готовности.
- Пиксель-в-пиксель дизайн — задаём чистую эстетику, не гонимся за макетом.

---

## 2. Вехи (для планов реализации)

| Веха | Состав | Готово, когда |
|---|---|---|
| **M1 — Фундамент** | каркас `apps/web` (App Router, Tailwind, провайдеры), `@repo/api-client`, `@repo/ui` (примитивы + Tailwind preset), tsconfig/eslint для Next в `@repo/config`, CI на web | `pnpm --filter web dev` поднимается; layout + провайдеры работают; lint/typecheck/build зелёные |
| **M2 — Каталог** | главная, `/products` (фильтры/пагинация/сортировка), `/products/[slug]` + отзывы/рейтинг, RSC + SEO-метаданные, адаптив | список и карточка отдаются из API через RSC; фильтры меняют URL; адаптив mobile-first |
| **M3 — Auth + корзина** | login/register, access-в-памяти + тихий refresh, гостевая корзина (zustand+localStorage) + мёрж при логине, страница корзины | гость набирает корзину, логинится → позиции слились в серверную; корзина редактируется |
| **M4 — Checkout + аккаунт** | форма checkout (react-hook-form+zod), оформление заказа, история заказов и карточка заказа, состояния успех/ошибка/пусто | сквозной checkout создаёт заказ; заказ виден в истории; Playwright E2E зелёный |

Каждая веха: свой план в `docs/superpowers/plans/`, TDD, свой PR.

---

## 3. Структура монорепо (добавляется в Фазе 2)

```
fullstack/
├─ apps/
│  ├─ api/                     # Nest.js (Фаза 1)
│  └─ web/                     # Next.js App Router — витрина (новое)
├─ packages/
│  ├─ types/                   # @repo/types — zod-контракты (Фаза 1)
│  ├─ config/                  # @repo/config — + tsconfig/eslint для Next (расширяем)
│  ├─ api-client/              # @repo/api-client — типизированный клиент к API (новое)
│  └─ ui/                      # @repo/ui — примитивы (shadcn/ui) + Tailwind preset (новое)
```

`apps/web` слушает порт **3001** — dev docker-compose уже отдаёт `CORS_ORIGINS=http://localhost:3001,...`.

---

## 4. Пакет `@repo/api-client`

«Глупый» типизированный клиент над `fetch`. Изоморфен: одна реализация работает и в React Server
Components (серверный fetch), и в браузере. React-query-хуки здесь **не** живут — они в `apps/web`
(у каждого клиента своя конфигурация кэша).

- Функции по доменам: `auth`, `categories`, `products`, `cart`, `orders`, `reviews` — сигнатуры и типы
  из `@repo/types` (`ProductListQuery`, `Paginated<Product>`, `CreateOrderInput`, и т.д.).
- Базовый URL из env (`NEXT_PUBLIC_API_URL`, дефолт `http://localhost:3000/api/v1`).
- Единый разбор ответа: успех → типизированные данные; ошибка (конверт `{statusCode,message,errors?}`)
  → бросается типизированный `ApiError` с `status`, `message`, `errors?`.
- Инъекция access-токена и `credentials:'include'` (для refresh-cookie) — через настраиваемый
  `fetcher`/интерсептор, чтобы серверный и клиентский вызовы конфигурировались по-разному.
- Списки используют конверт `{ items, total, page, limit }` (контракт §7 Фазы 1).

## 5. Пакет `@repo/ui`

Примитивы на shadcn/ui (генерируемые компоненты поверх Radix + Tailwind), общие для `web` (и позже
`admin`): `Button`, `Input`, `Label`, `Card`, `Badge`, `Dialog`, `Skeleton`, `Select`, `Toast`, и т.п.
Плюс общий **Tailwind preset** (токены цветов, радиусы, типографика). Страничные и доменные компоненты
(ProductCard, CartLine, CheckoutForm) — в `apps/web`, не в `@repo/ui`. Мобилка (RN) `@repo/ui` не
переиспользует (другие примитивы), но переиспользует `types`/`api-client`.

---

## 6. Архитектура `apps/web` (App Router)

### 6.1. Маршруты
```
app/
├─ layout.tsx                  # провайдеры (QueryClient, Auth, Cart, Toast), header/footer
├─ page.tsx                    # / — главная (RSC): промо + подборка товаров
├─ products/
│  ├─ page.tsx                 # /products — каталог (RSC): фильтры/пагинация/сортировка из searchParams
│  └─ [slug]/page.tsx          # /products/:slug — карточка (RSC): товар + рейтинг + отзывы
├─ cart/page.tsx               # /cart — корзина (client)
├─ checkout/page.tsx           # /checkout — оформление (client, требует логина)
├─ login/page.tsx              # /login (client)
├─ register/page.tsx           # /register (client)
├─ account/
│  ├─ orders/page.tsx          # /account/orders — история (client, требует логина)
│  └─ orders/[id]/page.tsx     # /account/orders/:id — карточка заказа (client)
├─ error.tsx                   # глобальный error boundary
└─ not-found.tsx               # 404
```

### 6.2. RSC vs client
- **RSC (серверное чтение, публичные ручки):** `/`, `/products`, `/products/[slug]`. Тянут данные через
  `@repo/api-client` на сервере; SEO-метаданные через `generateMetadata`; фильтры каталога — в URL
  (`?category&q&minPriceCents&maxPriceCents&sort&page&limit`), меняются клиентскими контролами через
  роутер, данные перезапрашиваются сервером.
- **Client-острова (интерактив/авторизация):** корзина, checkout, auth-формы, аккаунт — на TanStack Query
  поверх `api-client`, формы на react-hook-form + zod.

---

## 7. Данные и состояние

- **Серверное чтение:** RSC → `api-client` напрямую (без react-query), публичные эндпоинты.
- **Серверное состояние на клиенте:** TanStack Query — `me`, серверная `cart`, `orders`, мутации
  (добавление в корзину, checkout, оставить отзыв). Инвалидация кэша после мутаций.
- **Клиентское состояние:** zustand — гостевая корзина (persist в localStorage), эфемерный UI (drawer,
  тосты).
- **Формы:** react-hook-form + `@hookform/resolvers/zod`, схемы из `@repo/types` (те же, что валидирует API).

---

## 8. Аутентификация на клиенте

- **Access-JWT — в памяти** (module singleton + React-контекст), НЕ в `localStorage` (защита от XSS-кражи).
- **Refresh — httpOnly-cookie** (`path=/api/v1/auth`, выставляет API). Клиентские запросы идут с
  `credentials:'include'`.
- **Интерсептор `api-client`:** на `401` один раз дёргает `POST /auth/refresh` (cookie уедет автоматически),
  получает новый access, кладёт в память, повторяет исходный запрос; при повторном `401` → разлогин.
- **Восстановление сессии:** при загрузке приложения — тихий `POST /auth/refresh`; успех → есть access и
  `GET /auth/me`; неуспех → гость.
- **Логин/регистрация:** форма → `api-client` → access в память + сервер ставит refresh-cookie → мёрж
  гостевой корзины (см. §9) → редирект.
- **Логаут:** `POST /auth/logout` (🔒, требует access — см. Фазу 1) → чистим память и серверный кэш.
- **429 на `/auth/*`:** API лимитирует auth (15/мин). UI показывает понятный тост и просит подождать.

---

## 9. Гостевая корзина и мёрж

- **Гость:** корзина в zustand + localStorage — список `{ productId, qty }`. «В корзину» кладёт локально;
  UI показывает количество/итог из локальных данных + цены товаров.
- **Мёрж при логине:** после успешного логина по каждой локальной позиции — `POST /cart/items
  { productId, qty }`. Сервер сам складывает qty при повторном `productId` (upsert-инкремент — поведение
  Фазы 1). Затем локальная корзина очищается, приложение переключается на серверную (TanStack Query).
- **Залогинен:** корзина всегда серверная (`GET/POST/PATCH/DELETE /cart`), zustand-корзина не используется.
- **Стоки/цены:** финальная проверка стока — на checkout (сервер, oversell-safe из Фазы 1); UI показывает
  цену/итог по данным товаров, но истина о суммах — ответ сервера.

---

## 10. Обработка ошибок

- `api-client` нормализует конверт ошибки API `{statusCode,message,errors?}` → `ApiError`.
- **Формы:** `errors` (по полям) раскладываются в react-hook-form под соответствующие поля; общий
  `message` — в тост/алерт.
- **RSC:** отсутствующий или неактивный товар (API отдаёт 404 на неактивные) → `notFound()`; прочие сбои
  чтения → `error.tsx` с кнопкой «повторить».
- **Коды:** `401` → refresh/разлогин (§8); `403` → «нет доступа»; `409` (например, out-of-stock на
  checkout, конфликт корзины) → понятное сообщение и рефетч корзины; `429` → «слишком много попыток».
- Глобальные `app/error.tsx` и `app/not-found.tsx`; пустые состояния (пустая корзина, нет заказов).

---

## 11. Тестирование

- **Vitest (юниты):** утилиты форматирования (цена из `priceCents`+`currency`), стор гостевой корзины и
  **логика мёржа**, хелперы `api-client` (разбор конверта/ошибок), парсинг фильтров каталога из searchParams.
- **Playwright (E2E):** сквозной сценарий покупки (каталог → фильтр → товар → в корзину → checkout →
  заказ в истории) и сценарий **гость → набрал корзину → логин → позиции слились**. Прогон на mobile и
  desktop viewport. Тесты идут против запущенного API + БД (dev-контейнер), сиды дают демо-каталог/админа
  (как в Фазе 1).
- **Контракты:** типы из `@repo/types` — рассинхрон клиент/сервер ловит компилятор (typecheck в CI).
- **Приоритет:** ветвящаяся логика (мёрж корзины, refresh/ретрай, состояния ошибок), а не разметка.

---

## 12. DevOps / CI

- **Локально:** `apps/web` в dev-режиме на 3001; API на 3000 (dev-контейнер), Postgres+Mongo из
  docker-compose. `NEXT_PUBLIC_API_URL` из env (`.env.example` в `apps/web`).
- **CI (GitHub Actions):** расширить пайплайн на `web` — `lint`, `typecheck`, `build`; Playwright-джоб
  поднимает API+БД (сервисы) и гоняет E2E. Turbo кэширует задачи; `^build` уже собирает зависимые пакеты
  (`@repo/types`, `@repo/api-client`, `@repo/ui`) до web.
- **Dockerfile для web** — опционально позже (многостадийный, standalone-вывод Next); не критерий готовности.

---

## 13. Журнал решений (Фаза 2)

| # | Решение | Обоснование |
|---|---|---|
| 1 | RSC-first: публичные страницы серверные, интерактив — клиент | SEO/быстрый рендер каталога; чистое разделение чтения и интерактива; переиспользует CORS+cookie API |
| 2 | `@repo/api-client` — «глупый» изоморфный клиент, хуки в приложении | Один контракт для RSC и клиента; кэш-политику держит потребитель |
| 3 | `@repo/ui` — только примитивы (shadcn/ui) + preset; страничные компоненты в приложениях | Переиспользование web/admin без связывания страничной логики (roadmap откр. вопрос №2) |
| 4 | Access-JWT в памяти, refresh в httpOnly-cookie | Access недоступен для XSS; сессия переживает перезагрузку через тихий refresh |
| 5 | Гостевая корзина на клиенте + мёрж при логине | Лучший UX; соответствует roadmap; сервер сам складывает qty при мёрже |
| 6 | Полный дизайн фазы + реализация по вехам M1–M4 | Цельная картина + предсказуемая нарезка PR (как в Фазе 1) |
| 7 | Валюта из товара (enum), без переключателя в UI | Мультивалютность — non-goal; API уже фиксирует одну валюту на заказ |

---

## 14. Потребляемая поверхность API (из Фазы 1)

Базовый префикс `/api/v1`. Доступ: 🔓 публично · 🔒 авторизованный.

| Область | Эндпоинты | Прим. |
|---|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`(🔒), `GET /auth/me`(🔒) | access=Bearer, refresh=cookie; лимит 15/мин |
| Каталог | `GET /categories`, `GET /products`(фильтры+пагинация), `GET /products/:slug`(+`rating{avg,count}`) | конверт `{items,total,page,limit}` |
| Корзина | `GET /cart`(🔒), `POST /cart/items`(🔒), `PATCH/DELETE /cart/items/:productId`(🔒) | qty 1..10000; upsert складывает qty |
| Заказы | `POST /orders`(🔒, checkout), `GET /orders`(🔒, пагинация), `GET /orders/:id`(🔒) | out-of-stock→409; заказ фиксирует валюту |
| Отзывы | `GET /products/:productId/reviews`(пагинация+rating), `POST`(🔒) | один отзыв на (товар,пользователь) |

---

## 15. Открытые вопросы
1. **Визуальная айдентика:** палитра/типографика — уточнить на M2 через `frontend-design` skill (предложение:
   чистая нейтральная база + один акцент).
2. **Dockerfile для web:** делать в Фазе 2 или отложить до деплой-этапа? (Предложение: отложить, не критерий готовности.)
3. **Гостевой checkout:** пока checkout требует логина (API `/orders` 🔒). Разрешать оформление без
   регистрации — возможное расширение после Фазы 2.
