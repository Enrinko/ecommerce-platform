import { describe, it, expect } from 'vitest';
import { registerInput } from './auth';

describe('registerInput', () => {
  it('accepts a valid email + password', () => {
    const v = registerInput.parse({ email: 'a@b.com', password: 'secret123' });
    expect(v.email).toBe('a@b.com');
  });
  it('rejects a short password', () => {
    expect(() => registerInput.parse({ email: 'a@b.com', password: 'x' })).toThrow();
  });
  it('rejects a bad email', () => {
    expect(() => registerInput.parse({ email: 'nope', password: 'secret123' })).toThrow();
  });
});
