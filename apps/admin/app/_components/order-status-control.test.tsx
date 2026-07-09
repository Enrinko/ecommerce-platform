import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrderStatusControl } from './order-status-control';

describe('OrderStatusControl', () => {
  it('offers only valid transitions and applies the chosen one', () => {
    const onChange = vi.fn();
    render(<OrderStatusControl status="PAID" onChange={onChange} />);
    const options = Array.from(screen.getByRole('combobox').querySelectorAll('option'))
      .map((o) => (o as HTMLOptionElement).value)
      .filter(Boolean);
    expect(options).toEqual(['SHIPPED', 'CANCELLED']);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'SHIPPED' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onChange).toHaveBeenCalledWith('SHIPPED');
  });

  it('shows a terminal state with no control', () => {
    render(<OrderStatusControl status="DELIVERED" onChange={vi.fn()} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText(/final state/i)).toBeInTheDocument();
  });
});
