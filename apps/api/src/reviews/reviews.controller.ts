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
