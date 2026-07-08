import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { loginInput, registerInput } from '@repo/types';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

const REFRESH_COOKIE = 'refresh_token';

// Auth routes are the prime brute-force / credential-stuffing target and each
// login/register runs a deliberately expensive argon2 hash, so cap them well
// below the global baseline.
@Throttle({ default: { limit: 15, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      // Only sent over HTTPS in production; the long-lived refresh token must not
      // leak over a plain-HTTP downgrade/MITM.
      secure: this.config.get<string>('NODE_ENV') === 'production',
      // Persist for the refresh lifetime instead of dying as a session cookie.
      maxAge: this.tokens.refreshTtlMs(),
      path: '/api/v1/auth',
    });
  }

  private readRefresh(req: Request, body: { refreshToken?: string }): string {
    return (req.cookies?.[REFRESH_COOKIE] as string) ?? body?.refreshToken ?? '';
  }

  @Post('register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.register(registerInput.parse(body));
    this.setRefreshCookie(res, tokens.refreshToken);
    return tokens;
  }

  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.login(loginInput.parse(body));
    this.setRefreshCookie(res, tokens.refreshToken);
    return tokens;
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.refresh(this.readRefresh(req, body));
    this.setRefreshCookie(res, tokens.refreshToken);
    return tokens;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(this.readRefresh(req, body));
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: { id: string }) {
    return this.auth.me(user.id);
  }
}
