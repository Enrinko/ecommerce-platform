import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectConnection() private readonly mongo: Connection,
  ) {}

  @Get()
  async check() {
    const [postgres, mongo] = await Promise.all([this.pingPostgres(), this.pingMongo()]);
    if (!postgres || !mongo) {
      // Report the failing dependency and surface 503 so orchestrators can act.
      throw new ServiceUnavailableException({
        status: 'degraded',
        postgres: postgres ? 'up' : 'down',
        mongo: mongo ? 'up' : 'down',
      });
    }
    return { status: 'ok', postgres: 'up', mongo: 'up' };
  }

  private async pingPostgres(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async pingMongo(): Promise<boolean> {
    try {
      const res = await this.mongo.db?.admin().ping();
      return this.mongo.readyState === 1 && !!res;
    } catch {
      return false;
    }
  }
}
