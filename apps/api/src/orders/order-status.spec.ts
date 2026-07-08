import { canTransition } from './order-status';

describe('canTransition', () => {
  it('allows PENDING -> PAID and PENDING -> CANCELLED', () => {
    expect(canTransition('PENDING', 'PAID')).toBe(true);
    expect(canTransition('PENDING', 'CANCELLED')).toBe(true);
  });
  it('allows PAID -> SHIPPED -> DELIVERED', () => {
    expect(canTransition('PAID', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'DELIVERED')).toBe(true);
  });
  it('forbids terminal and skip transitions', () => {
    expect(canTransition('DELIVERED', 'PENDING')).toBe(false);
    expect(canTransition('CANCELLED', 'PAID')).toBe(false);
    expect(canTransition('PENDING', 'DELIVERED')).toBe(false);
  });
});
