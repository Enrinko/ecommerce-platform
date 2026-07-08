import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OrderStatus } from '@prisma/client';
import type { CreateOrderInput } from '@repo/types';
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
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });
    if (!cart || cart.items.length === 0) throw new BadRequestException('Cart is empty');

    return this.prisma.$transaction(async (tx) => {
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
