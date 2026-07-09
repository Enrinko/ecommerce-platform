import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product } from '@repo/types';
import { ProductCard } from '@/components/product-card';

const product: Product = {
  id: 'p1',
  title: 'USB-C Cable',
  slug: 'usb-c-cable',
  description: 'A cable',
  priceCents: 2500,
  currency: 'USD',
  stock: 10,
  images: [],
  isActive: true,
  categoryId: 'c1',
  category: { id: 'c1', name: 'Cables', slug: 'cables' },
  createdAt: new Date('2026-01-01'),
};

describe('ProductCard', () => {
  it('shows the title, category, and price and fires onPress', () => {
    const onPress = jest.fn();
    render(<ProductCard product={product} onPress={onPress} />);
    expect(screen.getByText('USB-C Cable')).toBeTruthy();
    expect(screen.getByText('Cables')).toBeTruthy();
    expect(screen.getByText('$25.00')).toBeTruthy();
    fireEvent.press(screen.getByText('USB-C Cable'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
