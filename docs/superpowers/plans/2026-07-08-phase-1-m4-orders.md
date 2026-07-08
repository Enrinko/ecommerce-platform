# Phase 1 · Milestone M4 — Cart, Orders, Reviews & Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Complete the Phase 1 backend — server-side cart, transactional checkout (stock decrement + price snapshot), an order-status state machine, product reviews on MongoDB with a denormalized rating aggregate, and a `MockPaymentProvider` behind a `PaymentProvider` interface.

**Architecture:** Cart/Order/Payment on Postgres (Prisma); reviews on MongoDB (Mongoose). Checkout runs in one interactive Prisma transaction: validate cart, snapshot title/price into `OrderItem`, decrement stock with a **conditional `updateMany` guarded against oversell**, create the payment intent via the injected `PaymentProvider`, then clear the cart. Contracts in `@repo/types`.

**Tech Stack:** NestJS 11, Prisma 6, Mongoose 8 (`@nestjs/mongoose`), zod, Jest + supertest. Runs in the Docker dev container.

## Global Constraints (inherited)
- Node ≥20 / pnpm ≥9; all commands via `docker compose exec dev <cmd>`.
- TS strict; routes under `api/v1`; error shape `{ statusCode, message, errors? }`.
- Money = integer cents. Contracts in `@repo/types` (zod). e2e `--runInBand --forceExit`.
- Auth from M3: `JwtAuthGuard` protects customer routes; `@Roles('ADMIN')` for admin. Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File Structure (created by M4)
```
apps/api/prisma/schema.prisma                 # + Cart, CartItem, Order, OrderItem, Payment, enums
packages/types/src/cart.ts, order.ts, review.ts  (+ index)
apps/api/src/cart/{cart.service.ts,cart.controller.ts,cart.module.ts}
apps/api/src/payment/{payment.provider.ts,mock-payment.provider.ts,payment.module.ts}
apps/api/src/orders/{order-status.ts,order-status.spec.ts,orders.service.ts,orders.controller.ts,orders.module.ts}
apps/api/src/reviews/{review.schema.ts,reviews.service.ts,reviews.controller.ts,reviews.module.ts}
apps/api/test/{cart.e2e-spec.ts,orders.e2e-spec.ts,reviews.e2e-spec.ts}
```

---

## Task 1: Order/Cart/Payment models + contracts

**Files:** modify `schema.prisma`; create `packages/types/src/{cart,order,review}.ts` (+ index); create `order-status.ts` (+ spec).

**Interfaces:** Produces Prisma `Cart`, `CartItem`, `Order`, `OrderItem`, `Payment`, enums `OrderStatus`, `PaymentStatus`; `@repo/types` exports cart/order/review contracts; `canTransition(from,to)` + `ALLOWED_TRANSITIONS`.

- [ ] **Step 1: Prisma models**

Append to `apps/api/prisma/schema.prisma`:
```prisma
enum OrderStatus {
  PENDING
  PAID
  SHIPPED
  DELIVERED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
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
  titleSnapshot      String
  priceCentsSnapshot Int
  qty                Int
}

model Payment {
  id          String        @id @default(uuid())
  orderId     String        @unique
  order       Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  provider    String
  providerRef String?
  status      PaymentStatus @default(PENDING)
  amountCents Int
}
```

Add the back-relations to existing models (edit them):
- `User`: add `cart Cart?` and `orders Order[]`.
- `Product`: add `cartItems CartItem[]` and `orderItems OrderItem[]`.

- [ ] **Step 2: Migrate**

Run: `docker compose exec dev pnpm --filter api exec prisma migrate dev --name orders`
Expected: migration created + applied; client regenerated.

- [ ] **Step 3: Order-status state machine (TDD unit)**

`apps/api/src/orders/order-status.spec.ts`:
```ts
import { canTransition } from './order-status';

describe('canTransition', () => {
  it('allows PENDING -> PAID and PENDING -> CANCELLED', () => {
    expect(canTransition('PENDING', 'PAID')).toBe(true);
    expect(canTransition('PENDING', 'CANCELLED')).toBe(true);
  });
  it('allows PAID -> SHIPPED -> DELIVERED', () => {
    expect(canTransition('PAID', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'DELIVERED')).toBe(true);
  });
  it('forbids terminal and skip transitions', () => {
    expect(canTransition('DELIVERED', 'PENDING')).toBe(false);
    expect(canTransition('CANCELLED', 'PAID')).toBe(false);
    expect(canTransition('PENDING', 'DELIVERED')).toBe(false);
  });
});
```

- [ ] **Step 4: Run — expect FAIL.** `docker compose exec dev pnpm --filter api test`

- [ ] **Step 5: Implement state machine + contracts**

`apps/api/src/orders/order-status.ts`:
```ts
import type { OrderStatus } from '@prisma/client';

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
```

`packages/types/src/cart.ts`:
```ts
import { z } from 'zod';

export const addCartItemInput = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().min(1),
});
export type AddCartItemInput = z.infer<typeof addCartItemInput>;

export const updateCartItemInput = z.object({ qty: z.number().int().min(1) });
export type UpdateCartItemInput = z.infer<typeof updateCartItemInput>;
```

`packages/types/src/order.ts`:
```ts
import { z } from 'zod';

export const orderStatus = z.enum(['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
export type OrderStatusValue = z.infer<typeof orderStatus>;

export const createOrderInput = z.object({
  shippingName: z.string().min(1),
  shippingAddr: z.string().min(1),
});
export type CreateOrderInput = z.infer<typeof createOrderInput>;

export const updateOrderStatusInput = z.object({ status: orderStatus });
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInput>;
```

`packages/types/src/review.ts`:
```ts
import { z } from 'zod';

export const createReviewInput = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
});
export type CreateReviewInput = z.infer<typeof createReviewInput>;

export const productRating = z.object({ avg: z.number(), count: z.number().int() });
export type ProductRating = z.infer<typeof productRating>;
```

Append to `packages/types/src/index.ts`:
```ts
export * from './cart';
export * from './order';
export * from './review';
```

- [ ] **Step 6: Run — expect PASS.** Build types: `docker compose exec dev pnpm --filter @repo/types build`. Commit:
```bash
git add -A
git commit -m "feat(orders): add cart/order/payment models, status machine, contracts"
```

---

## Task 2: Server cart (TDD e2e)

**Files:** create `apps/api/src/cart/{cart.service.ts,cart.controller.ts,cart.module.ts}`; modify `app.module.ts`; create `apps/api/test/cart.e2e-spec.ts`.

**Interfaces:** Produces `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:productId`, `DELETE /cart/items/:productId` — all `JwtAuthGuard`. Cart auto-created per user (lazy). `getOrCreate(userId)` returns cart with items+product.

- [ ] **Step 1: Failing e2e**

`apps/api/test/cart.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Cart (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let productId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `cart_${Date.now()}@example.com`, password: 'secret123' });
    token = reg.body.accessToken;

    const products = await request(app.getHttpServer()).get('/api/v1/products?limit=1');
    productId = products.body.items[0].id;
  });
  afterAll(async () => { await app.close(); });

  it('requires auth', async () => {
    await request(app.getHttpServer()).get('/api/v1/cart').expect(401);
  });

  it('starts empty, adds an item, updates qty, removes it', async () => {
    const empty = await request(app.getHttpServer())
      .get('/api/v1/cart').set('Authorization', `Bearer ${token}`).expect(200);
    expect(empty.body.items).toHaveLength(0);

    const added = await request(app.getHttpServer())
      .post('/api/v1/cart/items').set('Authorization', `Bearer ${token}`)
      .send({ productId, qty: 2 }).expect(201);
    expect(added.body.items).toHaveLength(1);
    expect(added.body.items[0].qty).toBe(2);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/cart/items/${productId}`).set('Authorization', `Bearer ${token}`)
      .send({ qty: 5 }).expect(200);
    expect(updated.body.items[0].qty).toBe(5);

    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/cart/items/${productId}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(removed.body.items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement CartService**

`apps/api/src/cart/cart.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { AddCartItemInput } from '@repo/types';
import { PrismaService } from '../prisma/prisma.service';

const withItems = {
  include: { items: { include: { product: true }, orderBy: { id: 'asc' as const } } },
};

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string) {
    const existing = await this.prisma.cart.findUnique({ where: { userId }, ...withItems });
    if (existing) return existing;
    return this.prisma.cart.create({ data: { userId }, ...withItems });
  }

  async addItem(userId: string, dto: AddCartItemInput) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || !product.isActive) throw new NotFoundException('Product not found');
    const cart = await this.getOrCreate(userId);
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: dto.productId } },
      update: { qty: { increment: dto.qty } },
      create: { cartId: cart.id, productId: dto.productId, qty: dto.qty },
    });
    return this.getOrCreate(userId);
  }

  async updateItem(userId: string, productId: string, qty: number) {
    const cart = await this.getOrCreate(userId);
    await this.prisma.cartItem.update({
      where: { cartId_productId: { cartId: cart.id, productId } },
      data: { qty },
    });
    return this.getOrCreate(userId);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.getOrCreate(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    return this.getOrCreate(userId);
  }
}
```

- [ ] **Step 4: Implement controller + module**

`apps/api/src/cart/cart.controller.ts`:
```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { addCartItemInput, updateCartItemInput } from '@repo/types';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentUser() user: { id: string }) {
    return this.cart.getOrCreate(user.id);
  }

  @Post('items')
  add(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.cart.addItem(user.id, addCartItemInput.parse(body));
  }

  @Patch('items/:productId')
  update(
    @CurrentUser() user: { id: string },
    @Param('productId') productId: string,
    @Body() body: unknown,
  ) {
    return this.cart.updateItem(user.id, productId, updateCartItemInput.parse(body).qty);
  }

  @Delete('items/:productId')
  remove(@CurrentUser() user: { id: string }, @Param('productId') productId: string) {
    return this.cart.removeItem(user.id, productId);
  }
}
```

`apps/api/src/cart/cart.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({ controllers: [CartController], providers: [CartService], exports: [CartService] })
export class CartModule {}
```

Add `CartModule` to `AppModule` imports.

- [ ] **Step 5: Run — expect PASS.** Commit:
```bash
git add -A
git commit -m "feat(cart): server-side cart with add/update/remove"
```

---

## Task 3: Payment provider + transactional checkout (TDD e2e)

**Files:** create `apps/api/src/payment/{payment.provider.ts,mock-payment.provider.ts,payment.module.ts}`; create `apps/api/src/orders/{orders.service.ts,orders.controller.ts,orders.module.ts}`; modify `app.module.ts`; create `apps/api/test/orders.e2e-spec.ts`.

**Interfaces:** Produces `PaymentProvider` token + `MockPaymentProvider`; `POST /orders` (checkout), `GET /orders`, `GET /orders/:id` (owner or admin). Checkout is atomic with oversell-safe stock decrement.

- [ ] **Step 1: Payment provider**

`apps/api/src/payment/payment.provider.ts`:
```ts
import type { PaymentStatus } from '@prisma/client';

export interface PaymentIntent {
  providerRef: string;
  status: PaymentStatus;
}

export interface PaymentProvider {
  createIntent(orderId: string, amountCents: number): Promise<PaymentIntent>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
```

`apps/api/src/payment/mock-payment.provider.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { PaymentIntent, PaymentProvider } from './payment.provider';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  async createIntent(orderId: string, _amountCents: number): Promise<PaymentIntent> {
    return { providerRef: `mock_${orderId}`, status: 'PAID' };
  }
}
```

`apps/api/src/payment/payment.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment.provider';
import { MockPaymentProvider } from './mock-payment.provider';

@Module({
  providers: [{ provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider }],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentModule {}
```

- [ ] **Step 2: Failing e2e**

`apps/api/test/orders.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let product: { id: string; priceCents: number };

  async function addToCart(productId: string, qty: number) {
    return request(app.getHttpServer())
      .post('/api/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ productId, qty });
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `order_${Date.now()}@example.com`, password: 'secret123' });
    token = reg.body.accessToken;

    const products = await request(app.getHttpServer()).get('/api/v1/products?limit=1');
    product = products.body.items[0];
  });
  afterAll(async () => { await app.close(); });

  it('rejects checkout with an empty cart (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders').set('Authorization', `Bearer ${token}`)
      .send({ shippingName: 'A', shippingAddr: 'B' }).expect(400);
  });

  it('checks out: order PAID, total correct, cart cleared', async () => {
    await addToCart(product.id, 2);
    const order = await request(app.getHttpServer())
      .post('/api/v1/orders').set('Authorization', `Bearer ${token}`)
      .send({ shippingName: 'Jane', shippingAddr: '1 Road' }).expect(201);

    expect(order.body.status).toBe('PAID');
    expect(order.body.totalCents).toBe(product.priceCents * 2);
    expect(order.body.items[0].priceCentsSnapshot).toBe(product.priceCents);

    const cart = await request(app.getHttpServer())
      .get('/api/v1/cart').set('Authorization', `Bearer ${token}`).expect(200);
    expect(cart.body.items).toHaveLength(0);

    const mine = await request(app.getHttpServer())
      .get('/api/v1/orders').set('Authorization', `Bearer ${token}`).expect(200);
    expect(mine.body.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects checkout exceeding stock (409)', async () => {
    await addToCart(product.id, 10_000_000);
    await request(app.getHttpServer())
      .post('/api/v1/orders').set('Authorization', `Bearer ${token}`)
      .send({ shippingName: 'Jane', shippingAddr: '1 Road' }).expect(409);
  });
});
```

- [ ] **Step 3: Run — expect FAIL.**

- [ ] **Step 4: Implement OrdersService (the core transaction)**

`apps/api/src/orders/orders.service.ts`:
```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateOrderInput } from '@repo/types';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payment/payment.provider';
import { canTransition } from './order-status';
import type { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
  ) {}

  async checkout(userId: string, dto: CreateOrderInput) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });
    if (!cart || cart.items.length === 0) throw new BadRequestException('Cart is empty');

    const order = await this.prisma.$transaction(async (tx) => {
      // 1. validate + compute total from current prices
      let totalCents = 0;
      for (const item of cart.items) {
        if (!item.product.isActive) {
          throw new ConflictException(`Product ${item.productId} is not available`);
        }
        totalCents += item.product.priceCents * item.qty;
      }

      // 2. create order + snapshot items
      const created = await tx.order.create({
        data: {
          userId,
          status: 'PENDING',
          totalCents,
          shippingName: dto.shippingName,
          shippingAddr: dto.shippingAddr,
          items: {
            create: cart.items.map((i) => ({
              productId: i.productId,
              titleSnapshot: i.product.title,
              priceCentsSnapshot: i.product.priceCents,
              qty: i.qty,
            })),
          },
        },
      });

      // 3. oversell-safe stock decrement: conditional updateMany must affect exactly 1 row
      for (const item of cart.items) {
        const res = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.qty } },
          data: { stock: { decrement: item.qty } },
        });
        if (res.count !== 1) {
          throw new ConflictException(`Insufficient stock for product ${item.productId}`);
        }
      }

      // 4. payment intent (Mock -> PAID immediately)
      const intent = await this.payment.createIntent(created.id, totalCents);
      await tx.payment.create({
        data: {
          orderId: created.id,
          provider: 'mock',
          providerRef: intent.providerRef,
          status: intent.status,
          amountCents: totalCents,
        },
      });

      const paid = await tx.order.update({
        where: { id: created.id },
        data: { status: intent.status === 'PAID' ? 'PAID' : 'PENDING' },
        include: { items: true, payment: true },
      });

      // 5. clear cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return paid;
    });

    return order;
  }

  listMine(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true, payment: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(userId: string, isAdmin: boolean, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, payment: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!isAdmin && order.userId !== userId) throw new ForbiddenException('Not your order');
    return order;
  }

  listAll() {
    return this.prisma.order.findMany({
      include: { items: true, payment: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, to: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (!canTransition(order.status, to)) {
      throw new ConflictException(`Cannot move order from ${order.status} to ${to}`);
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: to },
      include: { items: true, payment: true },
    });
  }
}
```

- [ ] **Step 5: Controller + module**

`apps/api/src/orders/orders.controller.ts`:
```ts
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { createOrderInput, updateOrderStatusInput } from '@repo/types';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type AuthUser = { id: string; role: 'CUSTOMER' | 'ADMIN' };

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  checkout(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.orders.checkout(user.id, createOrderInput.parse(body));
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: AuthUser) {
    return this.orders.listMine(user.id);
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.getOne(user.id, user.role === 'ADMIN', id);
  }

  @Get('admin/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  listAll() {
    return this.orders.listAll();
  }

  @Patch('admin/orders/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.orders.updateStatus(id, updateOrderStatusInput.parse(body).status);
  }
}
```

`apps/api/src/orders/orders.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PaymentModule } from '../payment/payment.module';

@Module({ imports: [PaymentModule], controllers: [OrdersController], providers: [OrdersService] })
export class OrdersModule {}
```

Add `OrdersModule` to `AppModule` imports.

- [ ] **Step 6: Run — expect PASS.** Commit:
```bash
git add -A
git commit -m "feat(orders): transactional checkout with oversell-safe stock decrement"
```

---

## Task 4: Admin order status transitions (TDD e2e)

**Files:** extend `apps/api/test/orders.e2e-spec.ts` (admin block).

**Interfaces:** Consumes `PATCH /admin/orders/:id/status` (already implemented in Task 3). This task verifies the guarded state machine end-to-end.

- [ ] **Step 1: Add admin-status e2e**

Append a second `describe` to `orders.e2e-spec.ts`:
```ts
describe('Admin order status (e2e)', () => {
  let app: INestApplication;
  let customerToken: string;
  let adminToken: string;
  let orderId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `ostatus_${Date.now()}@example.com`, password: 'secret123' });
    customerToken = reg.body.accessToken;

    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    adminToken = admin.body.accessToken;

    const products = await request(app.getHttpServer()).get('/api/v1/products?limit=1');
    await request(app.getHttpServer())
      .post('/api/v1/cart/items').set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: products.body.items[0].id, qty: 1 });
    const order = await request(app.getHttpServer())
      .post('/api/v1/orders').set('Authorization', `Bearer ${customerToken}`)
      .send({ shippingName: 'S', shippingAddr: 'A' });
    orderId = order.body.id;
  });
  afterAll(async () => { await app.close(); });

  it('customer cannot change status (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'SHIPPED' }).expect(403);
  });

  it('admin advances PAID -> SHIPPED -> DELIVERED', async () => {
    const shipped = await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SHIPPED' }).expect(200);
    expect(shipped.body.status).toBe('SHIPPED');

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DELIVERED' }).expect(200);
  });

  it('rejects an illegal transition (409)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PENDING' }).expect(409);
  });
});
```
> Precondition: the order is PAID after checkout (MockProvider). So PAID→SHIPPED→DELIVERED is valid; DELIVERED→PENDING is not.

- [ ] **Step 2: Run — expect PASS** (endpoint already exists). If green, commit:
```bash
git add -A
git commit -m "test(orders): admin order-status transitions e2e"
```

---

## Task 5: Product reviews on MongoDB + rating aggregate (TDD e2e)

**Files:** create `apps/api/src/reviews/{review.schema.ts,reviews.service.ts,reviews.controller.ts,reviews.module.ts}`; modify `app.module.ts`; create `apps/api/test/reviews.e2e-spec.ts`.

**Interfaces:** Produces `GET /products/:productId/reviews` (public) and `POST /products/:productId/reviews` (`JwtAuthGuard`). Maintains a denormalized `ProductRating` doc (avg, count) incrementally.

- [ ] **Step 1: Failing e2e**

`apps/api/test/reviews.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

describe('Reviews (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let productId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `rev_${Date.now()}@example.com`, password: 'secret123' });
    token = reg.body.accessToken;

    const products = await request(app.getHttpServer()).get('/api/v1/products?limit=1');
    productId = products.body.items[0].id;
  });
  afterAll(async () => { await app.close(); });

  it('requires auth to post a review', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/reviews`)
      .send({ rating: 5, title: 'Nice', body: 'Great' }).expect(401);
  });

  it('creates a review and lists it with the rating aggregate', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/reviews`).set('Authorization', `Bearer ${token}`)
      .send({ rating: 4, title: 'Good', body: 'Works well' }).expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}/reviews`).expect(200);
    expect(res.body.rating.count).toBeGreaterThanOrEqual(1);
    expect(res.body.rating.avg).toBeGreaterThan(0);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects an invalid rating (validation)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/reviews`).set('Authorization', `Bearer ${token}`)
      .send({ rating: 9, title: 'x', body: 'y' }).expect(400);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Mongoose schemas**

`apps/api/src/reviews/review.schema.ts`:
```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'reviews', timestamps: { createdAt: true, updatedAt: false } })
export class Review {
  @Prop({ required: true, index: true }) productId!: string;
  @Prop({ required: true }) userId!: string;
  @Prop({ required: true, min: 1, max: 5 }) rating!: number;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) body!: string;
}
export type ReviewDocument = HydratedDocument<Review>;
export const ReviewSchema = SchemaFactory.createForClass(Review);
ReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

@Schema({ collection: 'product_ratings' })
export class ProductRatingDoc {
  @Prop({ required: true, unique: true }) productId!: string;
  @Prop({ required: true, default: 0 }) avg!: number;
  @Prop({ required: true, default: 0 }) count!: number;
}
export type ProductRatingDocument = HydratedDocument<ProductRatingDoc>;
export const ProductRatingSchema = SchemaFactory.createForClass(ProductRatingDoc);
```

- [ ] **Step 4: ReviewsService (incremental aggregate)**

`apps/api/src/reviews/reviews.service.ts`:
```ts
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { CreateReviewInput } from '@repo/types';
import { ProductRatingDoc, Review } from './review.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviews: Model<Review>,
    @InjectModel(ProductRatingDoc.name) private readonly ratings: Model<ProductRatingDoc>,
  ) {}

  async create(productId: string, userId: string, dto: CreateReviewInput) {
    try {
      await this.reviews.create({ productId, userId, ...dto });
    } catch (e) {
      if ((e as { code?: number }).code === 11000) {
        throw new ConflictException('You already reviewed this product');
      }
      throw e;
    }
    // incremental average: avg' = (avg*count + rating) / (count+1)
    const current = (await this.ratings.findOne({ productId })) ?? { avg: 0, count: 0 };
    const count = current.count + 1;
    const avg = (current.avg * current.count + dto.rating) / count;
    await this.ratings.updateOne({ productId }, { $set: { avg, count } }, { upsert: true });
    return this.listByProduct(productId);
  }

  async listByProduct(productId: string) {
    const [items, rating] = await Promise.all([
      this.reviews.find({ productId }).sort({ createdAt: -1 }).lean(),
      this.ratings.findOne({ productId }).lean(),
    ]);
    return { items, rating: { avg: rating?.avg ?? 0, count: rating?.count ?? 0 } };
  }
}
```

- [ ] **Step 5: Controller + module**

`apps/api/src/reviews/reviews.controller.ts`:
```ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { createReviewInput } from '@repo/types';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Param('productId') productId: string) {
    return this.reviews.listByProduct(productId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: { id: string },
    @Param('productId') productId: string,
    @Body() body: unknown,
  ) {
    return this.reviews.create(productId, user.id, createReviewInput.parse(body));
  }
}
```

`apps/api/src/reviews/reviews.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ProductRatingDoc, ProductRatingSchema, Review, ReviewSchema } from './review.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: ProductRatingDoc.name, schema: ProductRatingSchema },
    ]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
```

Add `ReviewsModule` to `AppModule` imports.

- [ ] **Step 6: Run — expect PASS.** Then full pipeline:
`docker compose exec dev sh -c "pnpm lint && pnpm typecheck && pnpm test && pnpm --filter api test:e2e && pnpm build"`

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "feat(reviews): product reviews on MongoDB with denormalized rating aggregate"
```

---

## Self-Review

- **Spec coverage:** cart/order/payment models + status machine + contracts (T1); server cart (T2); PaymentProvider + transactional oversell-safe checkout + my-orders (T3); admin status transitions (T4); reviews on Mongo + incremental aggregate (T5). Completes the Phase 1 backend. ✓
- **Placeholders:** none — full code/commands each step. ✓
- **Type consistency:** `OrderStatus`/`PaymentStatus` from Prisma reused in state machine, service, and zod `orderStatus`; `PAYMENT_PROVIDER` symbol + `PaymentProvider` interface injected into OrdersService; contracts `createOrderInput`/`createReviewInput`/`addCartItemInput` shared controller↔service. ✓
- **Key logic verified by tests:** checkout total, price snapshot, empty-cart 400, oversell 409, cart cleared; status machine 200/403/409; review aggregate + validation 400 + auth 401.
- **Concurrency note:** stock decrement uses conditional `updateMany` (`where stock >= qty`, assert `count === 1`) inside the transaction — the actual guard against oversell under parallel checkouts, not the pre-check.
- **Mongo caveat:** reviews collection persists across e2e runs; unique `(productId,userId)` is per fresh-registered user, so reruns don't collide. `ProductRating` accumulates — tests assert `>=`, not exact.
```
