import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OrderStatus } from '@prisma/client';
import type { CreateOrderInput, PageQuery } from '@repo/types';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payment/payment.provider';
import { canTransition } from './order-status';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
  ) {}

  async checkout(userId: string, dto: CreateOrderInput) {
    return this.prisma.$transaction(async (tx) => {
      // 1. read the cart inside the transaction (spec §8.1 step 1)
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: true } } },
      });
      if (!cart || cart.items.length === 0) throw new BadRequestException('Cart is empty');

      // 1a. validate + compute total from current prices
      let totalCents = 0;
      for (const item of cart.items) {
        if (!item.product.isActive) {
          throw new ConflictException(`Product ${item.productId} is not available`);
        }
        totalCents += item.product.priceCents * item.qty;
      }

      // 1b. an order has a single currency; summing across currencies is meaningless.
      const currencies = new Set(cart.items.map((i) => i.product.currency));
      if (currencies.size > 1) {
        throw new ConflictException('Cart mixes currencies; check out one currency at a time');
      }
      const orderCurrency = cart.items[0].product.currency;

      // 2. create order + snapshot items
      const created = await tx.order.create({
        data: {
          userId,
          status: 'PENDING',
          totalCents,
          currency: orderCurrency,
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

      // 5. clear cart atomically. Delete exactly the items we read; if the count
      // differs, a concurrent checkout already consumed this cart — abort so the
      // whole transaction (order, items, stock) rolls back and no duplicate order
      // is committed from a single cart.
      const itemIds = cart.items.map((i) => i.id);
      const cleared = await tx.cartItem.deleteMany({
        where: { cartId: cart.id, id: { in: itemIds } },
      });
      if (cleared.count !== itemIds.length) {
        throw new ConflictException('Cart changed during checkout');
      }
      return paid;
    });
  }

  async listMine(userId: string, { page, limit }: PageQuery) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { userId },
        include: { items: true, payment: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
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

  async listAll({ page, limit }: PageQuery) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        include: { items: true, payment: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count(),
    ]);
    return { items, total, page, limit };
  }

  async updateStatus(id: string, to: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (!canTransition(order.status, to)) {
      throw new ConflictException(`Cannot move order from ${order.status} to ${to}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Optimistic lock: only transition if the status is still the one we
      // validated. Two concurrent PATCHes from the same source status can each
      // pass canTransition(); this guard lets exactly one win and 409s the other,
      // preventing an illegal path like SHIPPED -> CANCELLED.
      const moved = await tx.order.updateMany({
        where: { id, status: order.status },
        data: { status: to },
      });
      if (moved.count !== 1) {
        throw new ConflictException('Order status changed concurrently');
      }

      // Checkout always decremented stock, so cancelling must give it back.
      if (to === 'CANCELLED') {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.qty } },
          });
        }
      }

      return tx.order.findUnique({ where: { id }, include: { items: true, payment: true } });
    });
  }
}
