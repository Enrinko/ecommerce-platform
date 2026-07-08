import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { createOrderInput, updateOrderStatusInput } from '@repo/types';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type AuthUser = { id: string; role: 'CUSTOMER' | 'ADMIN' };

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  checkout(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.orders.checkout(user.id, createOrderInput.parse(body));
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: AuthUser) {
    return this.orders.listMine(user.id);
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.getOne(user.id, user.role === 'ADMIN', id);
  }

  @Get('admin/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  listAll() {
    return this.orders.listAll();
  }

  @Patch('admin/orders/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.orders.updateStatus(id, updateOrderStatusInput.parse(body).status);
  }
}
