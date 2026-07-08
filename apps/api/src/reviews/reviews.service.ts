import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { CreateReviewInput, PageQuery } from '@repo/types';
import { PrismaService } from '../prisma/prisma.service';
import { ProductRatingDoc, Review } from './review.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviews: Model<Review>,
    @InjectModel(ProductRatingDoc.name) private readonly ratings: Model<ProductRatingDoc>,
    private readonly prisma: PrismaService,
  ) {}

  async create(productId: string, userId: string, dto: CreateReviewInput) {
    // The catalog (Postgres) is the source of truth: reject reviews for products
    // that don't exist so Mongo can't accumulate orphan reviews/ratings.
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    try {
      await this.reviews.create({ productId, userId, ...dto });
    } catch (e) {
      if ((e as { code?: number }).code === 11000) {
        throw new ConflictException('You already reviewed this product');
      }
      throw e;
    }
    // Fold the new rating into the denormalized aggregate (§8.3) with a single
    // pipeline update: avg' = (avg*count + rating)/(count+1), count' = count+1.
    // Doing it in one document update makes it atomic, so concurrent reviews on
    // the same product can't lose an increment (read-modify-write would).
    await this.ratings.updateOne(
      { productId },
      [
        {
          $set: {
            avg: {
              $divide: [
                {
                  $add: [
                    { $multiply: [{ $ifNull: ['$avg', 0] }, { $ifNull: ['$count', 0] }] },
                    dto.rating,
                  ],
                },
                { $add: [{ $ifNull: ['$count', 0] }, 1] },
              ],
            },
            count: { $add: [{ $ifNull: ['$count', 0] }, 1] },
          },
        },
      ],
      { upsert: true },
    );
    return this.listByProduct(productId);
  }

  async getRating(productId: string): Promise<{ avg: number; count: number }> {
    const rating = await this.ratings.findOne({ productId }).lean();
    return { avg: rating?.avg ?? 0, count: rating?.count ?? 0 };
  }

  async listByProduct(productId: string, { page, limit }: PageQuery = { page: 1, limit: 20 }) {
    const [items, total, rating] = await Promise.all([
      this.reviews
        .find({ productId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.reviews.countDocuments({ productId }),
      this.ratings.findOne({ productId }).lean(),
    ]);
    return { items, total, page, limit, rating: { avg: rating?.avg ?? 0, count: rating?.count ?? 0 } };
  }
}
