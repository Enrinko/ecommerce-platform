import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthTokens, LoginInput, MeResponse, RegisterInput } from '@repo/types';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  private async issue(user: {
    id: string;
    email: string;
    role: 'CUSTOMER' | 'ADMIN';
  }): Promise<AuthTokens> {
    const accessToken = this.tokens.signAccess({ sub: user.id, role: user.role, email: user.email });
    const refreshToken = this.tokens.generateRefresh();
    // Opportunistically prune this user's expired sessions so the table doesn't
    // grow unbounded with dead rows across repeated logins.
    await this.prisma.refreshSession.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.tokens.hashToken(refreshToken),
        expiresAt: this.tokens.refreshExpiry(),
      },
    });
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterInput): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash: await this.passwords.hash(dto.password) },
    });
    return this.issue(user);
  }

  async login(dto: LoginInput): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      await this.passwords.verifyDummy(); // equalize timing with the real-user path
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!(await this.passwords.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issue(user);
  }

  async refresh(rawToken: string): Promise<AuthTokens> {
    if (!rawToken) throw new UnauthorizedException('Missing refresh token');
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: this.tokens.hashToken(rawToken) },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshSession.delete({ where: { id: session.id } }); // rotate
    return this.issue(session.user);
  }

  async logout(rawToken: string): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshSession.deleteMany({
      where: { tokenHash: this.tokens.hashToken(rawToken) },
    });
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: user.id, email: user.email, role: user.role };
  }
}
