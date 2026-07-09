import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/orders', () => ({ useCheckout: () => ({ mutateAsync: vi.fn() }) }));

import { CheckoutForm } from './checkout-form';

describe('CheckoutForm', () => {
  it('renders shipping fields and a place-order button', () => {
    render(<CheckoutForm />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /place order/i })).toBeInTheDocument();
  });
});
