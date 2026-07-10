import { render, screen, fireEvent } from '@testing-library/react-native';
import { CategoryFilter } from '@/components/category-filter';

const categories = [
  { id: 'c1', name: 'Cables', slug: 'cables' },
  { id: 'c2', name: 'Sleeves', slug: 'sleeves' },
];

describe('CategoryFilter', () => {
  it('lists categories and selects one', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    render(
      <CategoryFilter
        categories={categories}
        selected={undefined}
        onSelect={onSelect}
        onClose={onClose}
        visible
      />,
    );
    expect(screen.getByText('All products')).toBeTruthy();
    fireEvent.press(screen.getByText('Cables'));
    expect(onSelect).toHaveBeenCalledWith('cables');
    expect(onClose).toHaveBeenCalled();
  });

  it('clears the filter via "All products"', () => {
    const onSelect = jest.fn();
    render(
      <CategoryFilter
        categories={categories}
        selected="cables"
        onSelect={onSelect}
        onClose={jest.fn()}
        visible
      />,
    );
    fireEvent.press(screen.getByText('All products'));
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });
});
