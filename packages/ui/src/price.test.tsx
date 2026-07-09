import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Price } from './index';

describe('Price', () => {
  it('renders a monospaced formatted price', () => {
    render(<Price cents={1900} currency="USD" />);
    const el = screen.getByText('$19.00');
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('font-mono');
  });
});
