import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { createReviewInput, pageQuery } from '@repo/types';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Param('productId', ParseUUIDPipe) productId: string, @Query() query: unknown) {
    return this.reviews.listByProduct(productId, pageQuery.parse(query));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: { id: string },
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() body: unknown,
  ) {
    return this.reviews.create(productId, user.id, createReviewInput.parse(body));
  }
}
