import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Category } from '@repo/types';
import { CategoriesManager } from './categories-manager';

const categories: Category[] = [{ id: 'c1', name: 'Widgets', slug: 'widgets' }];

describe('CategoriesManager', () => {
  it('creates a category from valid input', async () => {
    const onCreate = vi.fn();
    render(
      <CategoriesManager
        categories={categories}
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Gadgets' } });
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'gadgets' } });
    fireEvent.click(screen.getByRole('button', { name: /add category/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ name: 'Gadgets', slug: 'gadgets' }));
  });

  it('deletes a category and shows the error banner', () => {
    const onDelete = vi.fn();
    render(
      <CategoriesManager
        categories={categories}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={onDelete}
        error="You can’t delete a category that still has products."
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith('c1');
    expect(screen.getByText(/still has products/i)).toBeInTheDocument();
  });
});
