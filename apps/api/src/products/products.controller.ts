import { Controller, Get, Param, Query } from '@nestjs/common';
import { productListQuery } from '@repo/types';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.products.list(productListQuery.parse(query));
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.products.getBySlug(slug);
  }
}
