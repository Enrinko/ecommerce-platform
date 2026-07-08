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
