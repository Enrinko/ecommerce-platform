import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductCard } from './product-card';

const product = {
  id: '1',
  title: 'USB-C Cable',
  slug: 'usb-c-cable',
  description: 'Braided.',
  priceCents: 1900,
  currency: 'USD',
  stock: 50,
  images: [],
  isActive: true,
  categoryId: 'c1',
  category: { id: 'c1', name: 'Cables', slug: 'cables' },
  createdAt: new Date().toISOString(),
} as never;

describe('ProductCard', () => {
  it('links to the product and shows title + mono price', () => {
    render(<ProductCard product={product} />);
    const link = screen.getByRole('link', { name: /usb-c cable/i });
    expect(link).toHaveAttribute('href', '/products/usb-c-cable');
    const price = screen.getByText('$19.00');
    expect(price.className).toContain('font-mono');
  });
});
