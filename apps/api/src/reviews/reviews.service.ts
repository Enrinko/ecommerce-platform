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
