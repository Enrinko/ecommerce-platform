import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Rating } from './index';

describe('Rating', () => {
  it('shows the average and count when reviewed', () => {
    render(<Rating avg={4.2} count={3} />);
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText(/3 reviews/)).toBeInTheDocument();
  });
  it('shows an empty state when unrated', () => {
    render(<Rating avg={0} count={0} />);
    expect(screen.getByText(/no reviews/i)).toBeInTheDocument();
  });
});
