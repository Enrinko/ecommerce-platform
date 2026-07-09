import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { pageQuery } from '@repo/types';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  listAll(@Query() query: unknown) {
    return this.products.listAllForAdmin(pageQuery.parse(query));
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.products.getById(id);
  }
}
