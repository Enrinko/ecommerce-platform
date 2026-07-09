import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Category } from '@repo/types';
import { ProductForm } from './product-form';

const categories: Category[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Cables', slug: 'cables' },
];

describe('ProductForm', () => {
  it('blocks submit and shows an error when required fields are empty', async () => {
    const onSubmit = vi.fn();
    render(<ProductForm categories={categories} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() =>
      expect(screen.getAllByText(/at least 1 character/i).length).toBeGreaterThan(0),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits parsed values (cents number + images array)', async () => {
    const onSubmit = vi.fn();
    render(<ProductForm categories={categories} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'USB-C Cable' } });
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'usb-c-cable' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A cable' } });
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '2500' } });
    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { value: '11111111-1111-1111-1111-111111111111' },
    });
    fireEvent.change(screen.getByLabelText(/image/i), {
      target: { value: 'https://x/img1.png\n\nhttps://x/img2.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'USB-C Cable',
        slug: 'usb-c-cable',
        priceCents: 2500,
        currency: 'USD',
        categoryId: '11111111-1111-1111-1111-111111111111',
        images: ['https://x/img1.png', 'https://x/img2.png'],
      }),
    );
  });
});
