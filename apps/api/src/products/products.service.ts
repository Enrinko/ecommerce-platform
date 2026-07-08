import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CreateProductInput,
  Paginated,
  Product,
  ProductListQuery,
  UpdateProductInput,
} from '@repo/types';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from '../reviews/reviews.service';

const ORDER: Record<ProductListQuery['sort'], Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  price_asc: { priceCents: 'asc' },
  price_desc: { priceCents: 'desc' },
};

const withCategory = {
  include: { category: { select: { id: true, name: true, slug: true } } },
} as const;

// Escape LIKE/ILIKE metacharacters so a user-supplied query is matched
// literally (Postgres uses backslash as the default LIKE escape char).
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
  ) {}

  async list(query: ProductListQuery): Promise<Paginated<Product>> {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.q ? { title: { contains: escapeLike(query.q), mode: 'insensitive' } } : {}),
      ...(query.minPriceCents !== undefined || query.maxPriceCents !== undefined
        ? { priceCents: { gte: query.minPriceCents, lte: query.maxPriceCents } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        ...withCategory,
        orderBy: ORDER[query.sort],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items: items as unknown as Product[], total, page: query.page, limit: query.limit };
  }

  async getBySlug(slug: string): Promise<Product & { rating: { avg: number; count: number } }> {
    // Public endpoint: inactive products must not be reachable by direct slug.
    const found = await this.prisma.product.findFirst({
      where: { slug, isActive: true },
      ...withCategory,
    });
    if (!found) throw new NotFoundException(`Product "${slug}" not found`);
    // Merge in the denormalized review aggregate (spec §7/§8.3).
    const rating = await this.reviews.getRating(found.id);
    return { ...(found as unknown as Product), rating };
  }

  create(data: CreateProductInput) {
    return this.prisma.product.create({ data });
  }

  update(id: string, data: UpdateProductInput) {
    return this.prisma.product.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }
}
