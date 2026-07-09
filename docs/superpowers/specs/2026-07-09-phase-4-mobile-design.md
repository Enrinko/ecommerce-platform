# Фаза 4 — Мобильное приложение (React Native / Expo) — детальный дизайн

- **Дата:** 2026-07-09
- **Статус:** черновик на ревью
- **Фаза:** 4 из 4 (финальная)
- **Верхнеуровневый план:** `docs/superpowers/specs/2026-07-07-ecommerce-platform-roadmap.md`
- **Предыдущие фазы:** Фаза 1 (backend API), Фаза 2 (веб-витрина), Фаза 3 (админ-панель) — в `main`.

---

## 1. Цель фазы

Дать покупателю мобильный клиент с **функциональным паритетом веб-витрины**: каталог → товар →
корзина → checkout → авторизация → заказы — отдельным приложением `apps/mobile` (Expo / React Native)
поверх того же API, переиспользуя `@repo/types` и `@repo/api-client`.

На выходе: `apps/mobile` бандлится (Expo Web), сквозной сценарий покупки проходит в Playwright
(Expo Web-таргет), юнит/компонент-тесты (RNTL) зелёные, CI зелёный.

### В объёме
Expo-каркас + Expo Router; навигация (Shop/Cart/Account табы + стеки); каталог с
поиском/категориями/пагинацией; экран товара с рейтингом и отзывами; гостевая корзина
(zustand + AsyncStorage) с мержем в серверную при логине; checkout (rhf + zod); auth
(access-в-памяти + refresh в SecureStore); история заказов и деталь; тесты RNTL + Playwright
(Expo Web) + CI-джоб.

### Вне объёма (осознанно)
- Нативные сборки (EAS build), публикация в сторы — точки расширения.
- Push-уведомления, deep links, офлайн-режим/синхронизация.
- Нативный E2E на эмуляторе (Detox/Maestro) — **эмулятора нет в среде**; верификация через
  Expo Web + Playwright (тестирует web-таргет RN, не native) — осознанный компромисс.
- Паритет «пиксель-в-пиксель» с вебом (roadmap §3): общий домен, нативный UI.

---

## 2. Ограничения среды (определяют стратегию верификации)

Хост — Windows с EOL Node 12 без pnpm; всё выполняется в Docker-контейнере `fullstack-dev-1`
(Linux, **headless, без GUI и без Android/iOS-эмулятора**). Следствия:

- **Юнит/компонент-тесты** (Jest + React Native Testing Library) гоняются headless в контейнере — основной способ TDD.
- **Сквозной E2E** — через **Expo Web** (react-native-web, который Expo Router поддерживает из
  коробки) + **Playwright** в chromium (уже в кэше от web/admin). Даёт реальный сквозной прогон
  без эмулятора. Тестирует web-таргет RN — не полноценный native, но проверяет бизнес-логику,
  навигацию и интеграцию с API сквозным сценарием.
- **Нативный запуск на устройстве** (`expo start` → Expo Go / эмулятор) — ручной шаг вне авто-CI;
  документируется в README `apps/mobile`, в критерии готовности не входит.

Команды выполняются в контейнере:
`docker exec fullstack-dev-1 sh -c "cd /app && corepack enable >/dev/null 2>&1; pnpm ..."`.

---

## 3. Стек и переиспользование

| Слой | Решение |
|---|---|
| Рантайм | Expo SDK 52 (RN 0.76, React 18.3) |
| Роутинг | **Expo Router** (file-based, поверх React Navigation) — настоящие URL в web для Playwright |
| Данные | TanStack Query 5 поверх `@repo/api-client` |
| Клиентский стейт | zustand (+ persist через AsyncStorage — гостевая корзина) |
| Формы | react-hook-form + `@hookform/resolvers/zod` (схемы из `@repo/types`) |
| Auth-хранилище | access-JWT в памяти; refresh — `expo-secure-store` |
| Контракты | `@repo/types` (без изменений) |
| API-клиент | `@repo/api-client` (**без изменений**) через тонкую обёртку `lib/api.ts` |
| Тесты | Jest (`jest-expo`) + `@testing-library/react-native`; Playwright (Expo Web) |

**Переиспользуется:** `@repo/types` (контракты), `@repo/api-client` (типизированные fetch-функции).
**НЕ переиспользуется:** `@repo/ui` (Tailwind/DOM-примитивы; у RN свои `View/Text/Pressable`).

### 3.1. Обёртка `lib/api.ts` (почему api-client НЕ меняется)

`@repo/api-client` `apiFetch` резолвит baseUrl как `opts.baseUrl ?? process.env.NEXT_PUBLIC_API_URL
?? 'http://localhost:3000/api/v1'`. В RN `process.env.NEXT_PUBLIC_API_URL` отсутствует, поэтому
обёртка **явно передаёт** `baseUrl` из `EXPO_PUBLIC_API_URL` (дефолт `http://localhost:3000/api/v1`
— совпадает для Expo Web E2E).

Refresh/logout мобилке нужно слать refreshToken **в теле** (не в cookie). API `AuthController.readRefresh`
уже читает `req.cookies?.refresh_token ?? body?.refreshToken`. api-client `refresh(opts)` строит
`init: { ...opts?.init, method: 'POST' }` — спред сохраняет `opts.init.body`, поэтому обёртка
передаёт `refresh({ init: { body: JSON.stringify({ refreshToken }) } })` **без изменения api-client**.
`apiFetch` сам проставит `content-type: application/json`.

```ts
// lib/api.ts (эскиз)
const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;

export async function authed<T>(call: (opts: { baseUrl: string; accessToken?: string }) => Promise<T>): Promise<T> {
  try {
    return await call({ baseUrl: BASE, accessToken: accessToken ?? undefined });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    const rt = await SecureStore.getItemAsync('refresh_token');
    if (!rt) throw e;
    const tokens = await refresh({ baseUrl: BASE, init: { body: JSON.stringify({ refreshToken: rt }) } });
    accessToken = tokens.accessToken;
    await SecureStore.setItemAsync('refresh_token', tokens.refreshToken);
    return call({ baseUrl: BASE, accessToken });
  }
}
```

---

## 4. Структура `apps/mobile` (Expo Router)

```
apps/mobile/
├─ app.json / app.config.ts     # Expo config (name, scheme, web bundler: metro)
├─ package.json                 # expo, expo-router, react-native, react-native-web, deps
├─ tsconfig.json                # extends expo/tsconfig.base + @repo/config
├─ babel.config.js  metro.config.js
├─ jest.config.js  jest.setup.ts
├─ playwright.config.ts         # Expo Web + api webServers, baseURL :8081
├─ e2e/
│  ├─ global-setup.ts           # prisma migrate deploy + db:seed
│  └─ purchase.spec.ts          # сквозной сценарий (Expo Web)
├─ lib/
│  ├─ api.ts                    # baseUrl + authed (401→refresh→retry)
│  ├─ auth.ts                   # SecureStore refresh + access-в-памяти
│  ├─ guest-cart.ts             # zustand + AsyncStorage persist
│  ├─ cart.ts                   # merge + server-cart хуки (TanStack Query)
│  ├─ catalog.ts  orders.ts     # query-хуки
│  └─ format.ts                 # цена/дата
├─ components/                  # Price, Rating, Button, Field, ProductCard, ...
└─ app/
   ├─ _layout.tsx               # Providers (QueryClient + AuthProvider) + Stack
   ├─ index.tsx                 # → redirect /(tabs)/shop
   ├─ (auth)/{login,register}.tsx
   ├─ (tabs)/
   │  ├─ _layout.tsx            # Tabs: Shop · Cart · Account
   │  ├─ shop/{index,[slug]}.tsx
   │  ├─ cart.tsx
   │  └─ account/{index,orders/[id]}.tsx
   └─ checkout.tsx
```

**Auth-гейт:** `account/*` и `checkout` требуют сессию — хук `useRequireAuth()` (нет сессии →
`router.replace('/(auth)/login')`), аналог web `RequireAuth`.

---

## 5. Вехи

| Веха | Состав | Готово, когда |
|---|---|---|
| **M1 — Фундамент + auth** | Expo-каркас, Expo Router, tab/stack-навигация, `lib/api.ts`+`lib/auth.ts` (SecureStore), `AuthProvider` (silent refresh), экраны login/register, базовые `components/`, Jest+RNTL инфра, Playwright(Expo Web) конфиг | бандлится (web); login/register работают; RNTL + E2E-каркас зелёные; typecheck/lint зелёные |
| **M2 — Каталог + товар** | таб Shop: каталог (поиск/категория/пагинация через search params), экран товара (Price/Rating + отзывы) | каталог и товар рендерятся из API; тесты зелёные |
| **M3 — Корзина + checkout** | гостевая корзина (zustand+AsyncStorage) + мерж при логине; экран корзины (qty/remove/total); checkout (rhf+zod) → заказ | add→cart→checkout→заказ создан (PAID); тесты зелёные |
| **M4 — Заказы + E2E** | таб Account: история заказов + деталь; **сквозной Playwright** (Expo Web): гость→add→register→checkout→заказ; CI-джоб `mobile-e2e` | сквозной сценарий зелёный локально и в CI |

Каждая веха: свой план (`docs/superpowers/plans/`), TDD, свой PR, зелёный CI.

---

## 6. Поток данных и auth

- **Чтение** (каталог/товар/заказы): `useQuery` поверх `api-client` через `lib/api.ts` (`baseUrl`).
  Публичные ручки — без токена; заказы — через `authed`.
- **Мутации** (cart add/update/remove, checkout): `useMutation` с инвалидацией ключей (`['cart']`, `['orders']`).
- **Auth:** старт → читаем refresh из SecureStore → `refresh({body:{refreshToken}})` → access в память +
  `me()` → сессия `authed`; иначе `guest`. Login/register → сохраняем оба токена (access в память,
  refresh в SecureStore) → **мерж гостевой корзины** в серверную. Logout → `logout({body:{refreshToken}})`
  + очистка SecureStore + сброс access.
- **Гостевая корзина:** `zustand + persist` (AsyncStorage), снимок данных товара (title/price/image);
  при логине `mergeGuestCartIntoServer` (последовательные `addCartItem`) → очистка гостевой.

---

## 7. Обработка ошибок (паритет web)

- api-client нормализует конверт `{statusCode,message,errors?}` → `ApiError`.
- `401` → `authed` refresh-retry; провал refresh → сброс сессии → экран login.
- checkout `409` (нет стока / смешанные валюты) / `400` → понятное сообщение на экране, без падения.
- Пустые состояния (корзина/заказы), лоадеры (`isLoading`), сетевой сбой → сообщение + повтор.
- Формы: пофайловые ошибки rhf (zod), общий `message` — баннер.

---

## 8. Тестирование

### 8.1. Юнит/компонент (Jest + RNTL) — основной TDD-слой
- preset `jest-expo`, `@testing-library/react-native`, `jest.setup.ts`.
- Моки: `expo-secure-store`, `expo-router` (`useRouter`/`useLocalSearchParams`/`Link`),
  `@repo/api-client` (`jest.mock`), `@react-native-async-storage/async-storage`.
- Покрываем: рендер экранов (каталог/товар/корзина/checkout/orders), валидацию форм,
  хуки корзины (add/setQty/remove/merge), `AuthProvider` (сессия/refresh/logout), auth-гейт.

### 8.2. Сквозной (Expo Web + Playwright)
- `playwright.config.ts`: `webServer` = `pnpm --filter api start:dev` + `pnpm --filter mobile exec
  expo start --web --port 8081`; `baseURL http://localhost:8081`; `globalSetup` = migrate + seed.
- `purchase.spec.ts`: гость открывает товар (seeded `usb-c-cable`) → добавляет в корзину →
  регистрируется → checkout → заказ создан. Зеркало `apps/web/e2e/purchase.spec.ts`.

### 8.3. CI
- Новый джоб **`mobile-e2e`** (зеркало `admin-e2e`): postgres+mongo сервисы; env с
  **`CORS_ORIGINS=http://localhost:8081`** (Expo Web origin), `EXPO_PUBLIC_API_URL`,
  admin/JWT-секреты; `@repo/types` build; playwright chromium; `pnpm --filter mobile run test:e2e`;
  upload `test-results` при падении.
- `mobile` подхватится turbo для `lint`/`typecheck`/`test`/`build` как остальные приложения.

---

## 9. DevOps / CI

- **Локально:** Expo Web dev на 8081; API на 3000; Postgres+Mongo из compose. `.env.example`
  (`EXPO_PUBLIC_API_URL`) в `apps/mobile`.
- **CI:** три существующих джоба (`verify`, `e2e`, `admin-e2e`) + новый `mobile-e2e`.
  **Урок Phase 2:** e2e-джобы обязаны задавать `CORS_ORIGINS` под origin своего фронта
  (здесь `http://localhost:8081`), иначе браузерные кросс-запросы к API блокируются.
- **Env-урок Phase 3:** устаревшие long-running dev-серверы прошлых сессий держат порты со старым
  манифестом — при живой проверке убивать по PID и рестартовать; авто-e2e поднимает свои серверы.

---

## 10. Журнал решений (Фаза 4)

| # | Решение | Обоснование |
|---|---|---|
| 1 | Отдельное `apps/mobile` (Expo) | roadmap реш. №4; мобильный клиент в объёме проекта |
| 2 | **Expo Router** (не голый React Navigation) | file-based, настоящие URL в web → удобно Playwright; зеркалит App Router web/admin |
| 3 | Верификация через **Expo Web + Playwright** | эмулятора нет в среде; даёт реальный сквозной прогон без native |
| 4 | api-client и types **без изменений** | refresh через `init.body`, baseUrl через обёртку — контракты стабильны |
| 5 | refresh в **SecureStore** (не cookie) | нативная замена httpOnly-cookie; API уже принимает refresh в body |
| 6 | Гостевая корзина + мерж (паритет web) | функциональный паритет; переиспользуем паттерн `guest-cart`/`merge` |
| 7 | `@repo/ui` не переиспользуется | Tailwind/DOM ≠ RN-примитивы; у мобилки свои `components/` |
| 8 | Нативный E2E (Detox/эмулятор) вне объёма | нет эмулятора в среде; честно зафиксировано как расширение |

---

## 11. Потребляемая поверхность API (без новых ручек)

Базовый префикс `/api/v1`. Все — существующие (Фазы 1–3):

| Область | Ручки |
|---|---|
| Auth | `POST /auth/register`, `/login`, `/refresh`, `/logout`(🔒), `GET /auth/me`(🔒) |
| Каталог | `GET /categories`, `GET /products`, `GET /products/:slug` |
| Отзывы | `GET /products/:id/reviews` (по productId) |
| Корзина | `GET /cart`(🔒), `POST /cart/items`(🔒), `PATCH/DELETE /cart/items/:productId`(🔒) |
| Заказы | `POST /orders`(🔒), `GET /orders`(🔒), `GET /orders/:id`(🔒) |

Фаза 4 — **чистое потребление**: ни API, ни `@repo/types`, ни `@repo/api-client` не меняются
(кроме, возможно, точечных дев-зависимостей). Если что-то потребует изменения контракта — стоп и пересмотр.

---

## 12. Открытые вопросы

1. **Реальное устройство/эмулятор:** `localhost` не резолвится с устройства — `EXPO_PUBLIC_API_URL`
   под IP хоста; для нашей верификации (Expo Web) `localhost:3000` подходит. Нативный запуск — ручной, вне CI.
2. **Оплата:** MockPaymentProvider (как везде) — checkout сразу `PAID`.
3. **Expo Web порт в CI:** Expo dev-сервер слушает `8081` (Metro); Playwright `baseURL`/`CORS_ORIGINS`
   привязаны к нему. Если порт конфликтует — вынести в env.
