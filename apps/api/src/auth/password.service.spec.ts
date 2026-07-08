import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const svc = new PasswordService();
  it('verifies a correct password', async () => {
    const hash = await svc.hash('secret123');
    expect(await svc.verify(hash, 'secret123')).toBe(true);
  });
  it('rejects a wrong password', async () => {
    const hash = await svc.hash('secret123');
    expect(await svc.verify(hash, 'wrong')).toBe(false);
  });
});
