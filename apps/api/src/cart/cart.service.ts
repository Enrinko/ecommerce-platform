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
