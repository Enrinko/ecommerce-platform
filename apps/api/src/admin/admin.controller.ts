import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { pageQuery } from '@repo/types';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users(@Query() query: unknown) {
    return this.admin.listUsers(pageQuery.parse(query));
  }

  @Get('stats')
  stats() {
    return this.admin.stats();
  }
}
