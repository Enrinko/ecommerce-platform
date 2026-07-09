import { render, screen } from '@testing-library/react-native';
import { Price } from '@/components/price';

describe('Price', () => {
  it('formats cents as a currency amount', () => {
    render(<Price cents={2500} currency="USD" />);
    expect(screen.getByText('$25.00')).toBeTruthy();
  });
  it('falls back to a prefixed code for unknown currencies', () => {
    render(<Price cents={1000} currency="JPY" />);
    expect(screen.getByText('JPY 10.00')).toBeTruthy();
  });
});
