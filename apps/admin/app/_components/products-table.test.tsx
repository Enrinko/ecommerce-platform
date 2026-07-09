import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@repo/types';
import { ProductsTable } from './products-table';

const base: Product = {
  id: 'p1',
  title: 'Active Widget',
  slug: 'active-widget',
  description: 'd',
  priceCents: 2500,
  currency: 'USD',
  stock: 7,
  images: [],
  isActive: true,
  categoryId: 'c1',
  category: { id: 'c1', name: 'Widgets', slug: 'widgets' },
  createdAt: new Date('2026-01-01'),
};
const inactive: Product = { ...base, id: 'p2', title: 'Hidden Widget', isActive: false };

describe('ProductsTable', () => {
  it('renders a row per product and flags inactive ones', () => {
    render(<ProductsTable products={[base, inactive]} onSetActive={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Active Widget')).toBeInTheDocument();
    expect(screen.getByText('Hidden Widget')).toBeInTheDocument();
    expect(screen.getByText(/inactive/i)).toBeInTheDocument();
  });

  it('deactivates an active product and deletes on demand', () => {
    const onSetActive = vi.fn();
    const onDelete = vi.fn();
    render(<ProductsTable products={[base]} onSetActive={onSetActive} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }));
    expect(onSetActive).toHaveBeenCalledWith('p1', false);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith('p1');
  });

  it('shows an empty state with no products', () => {
    render(<ProductsTable products={[]} onSetActive={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/no products/i)).toBeInTheDocument();
  });
});
