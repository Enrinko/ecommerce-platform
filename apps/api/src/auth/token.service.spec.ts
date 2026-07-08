import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

function make(): TokenService {
  const jwt = new JwtService({ secret: 'x'.repeat(32) });
  const config = { get: (k: string) => (k === 'REFRESH_TTL' ? '7d' : '15m') } as unknown as ConfigService;
  return new TokenService(jwt, config);
}

describe('TokenService', () => {
  const svc = make();
  it('hashToken is deterministic', () => {
    expect(svc.hashToken('abc')).toBe(svc.hashToken('abc'));
  });
  it('generateRefresh returns unique opaque tokens', () => {
    expect(svc.generateRefresh()).not.toBe(svc.generateRefresh());
  });
  it('signAccess produces a non-empty JWT string', () => {
    const t = svc.signAccess({ sub: 'u1', role: 'CUSTOMER', email: 'a@b.com' });
    expect(t.split('.')).toHaveLength(3);
  });
});
