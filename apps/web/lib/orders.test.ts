import { describe, expect, it } from 'vitest';
import { orderStatusLabel } from './orders';

describe('orderStatusLabel', () => {
  it('maps known statuses to display text', () => {
    expect(orderStatusLabel('PAID')).toBe('Paid');
    expect(orderStatusLabel('CANCELLED')).toBe('Cancelled');
  });
  it('passes through unknown values', () => {
    expect(orderStatusLabel('WAT')).toBe('WAT');
  });
});
