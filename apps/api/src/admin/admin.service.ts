import { Injectable } from '@nestjs/common';
import type { OrderStatus } from '@prisma/client';
import type { AdminStats, PageQuery, Paginated, UserListItem } from '@repo/types';
import { PrismaService } from '../prisma/prisma.service';

const REVENUE_STATUSES: OrderStatus[] = ['PAID', 'SHIPPED', 'DELIVERED'];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers({ page, limit }: PageQuery): Promise<Paginated<UserListItem>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count(),
    ]);
    const items: UserListItem[] = rows.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      orderCount: u._count.orders,
    }));
    return { items, total, page, limit };
  }

  async stats(): Promise<AdminStats> {
    const [ordersTotal, revenue, productCount, userCount] = await this.prisma.$transaction([
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        _sum: { totalCents: true },
        where: { status: { in: REVENUE_STATUSES } },
      }),
      this.prisma.product.count(),
      this.prisma.user.count(),
    ]);
    // groupBy is kept out of the $transaction([]) tuple: Prisma mis-infers its
    // _count type inside the array form. Stats are read-only, so a separate read
    // is fine (no snapshot guarantee needed across the status histogram).
    const grouped = await this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
    const ordersByStatus = { PENDING: 0, PAID: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 };
    for (const g of grouped) ordersByStatus[g.status] = g._count._all;
    return {
      ordersTotal,
      ordersByStatus,
      revenueCents: revenue._sum.totalCents ?? 0,
      productCount,
      userCount,
    };
  }
}
