import { Injectable } from '@nestjs/common';
import type { CreateCategoryInput, UpdateCategoryInput } from '@repo/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  create(data: CreateCategoryInput) {
    return this.prisma.category.create({ data });
  }

  update(id: string, data: UpdateCategoryInput) {
    return this.prisma.category.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }
}
