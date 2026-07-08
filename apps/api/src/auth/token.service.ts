import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';

export interface AccessPayload {
  sub: string;
  role: 'CUSTOMER' | 'ADMIN';
  email: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccess(payload: AccessPayload): string {
    const expiresIn = this.config.get<string>('ACCESS_TTL') ?? '15m';
    // @types/jsonwebtoken@9 types expiresIn as a template-literal StringValue;
    // a config-driven string is valid at runtime, so cast to the sign() options type.
    return this.jwt.sign(payload, { expiresIn } as Parameters<JwtService['sign']>[1]);
  }

  generateRefresh(): string {
    return randomBytes(32).toString('hex');
  }

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  refreshExpiry(): Date {
    const ttl = this.config.get<string>('REFRESH_TTL') ?? '7d';
    const days = Number(ttl.replace('d', '')) || 7;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
