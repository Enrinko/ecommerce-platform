import { render, screen } from '@testing-library/react-native';
import { Rating } from '@/components/rating';

describe('Rating', () => {
  it('shows the average and count when reviewed', () => {
    render(<Rating avg={4.5} count={12} />);
    expect(screen.getByText(/4\.5/)).toBeTruthy();
    expect(screen.getByText(/12/)).toBeTruthy();
  });
  it('shows an unrated state when there are no reviews', () => {
    render(<Rating avg={0} count={0} />);
    expect(screen.getByText(/no reviews/i)).toBeTruthy();
  });
});
