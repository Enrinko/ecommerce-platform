import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { addCartItemInput, updateCartItemInput } from '@repo/types';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentUser() user: { id: string }) {
    return this.cart.getOrCreate(user.id);
  }

  @Post('items')
  add(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.cart.addItem(user.id, addCartItemInput.parse(body));
  }

  @Patch('items/:productId')
  update(
    @CurrentUser() user: { id: string },
    @Param('productId') productId: string,
    @Body() body: unknown,
  ) {
    return this.cart.updateItem(user.id, productId, updateCartItemInput.parse(body).qty);
  }

  @Delete('items/:productId')
  remove(@CurrentUser() user: { id: string }, @Param('productId') productId: string) {
    return this.cart.removeItem(user.id, productId);
  }
}
