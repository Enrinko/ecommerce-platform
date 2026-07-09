import { render, screen, fireEvent } from '@testing-library/react-native';
import { CartView } from '@/components/cart-view';

const lines = [
  { productId: 'p1', title: 'USB-C Cable', priceCents: 2500, currency: 'USD', qty: 2 },
  { productId: 'p2', title: 'Laptop Sleeve', priceCents: 4000, currency: 'USD', qty: 1 },
];

describe('CartView', () => {
  it('renders lines, a total, and fires remove/checkout', () => {
    const onRemove = jest.fn();
    const onCheckout = jest.fn();
    render(
      <CartView lines={lines} onSetQty={jest.fn()} onRemove={onRemove} onCheckout={onCheckout} />,
    );
    expect(screen.getByText('USB-C Cable')).toBeTruthy();
    // total = 2*2500 + 1*4000 = 9000 → $90.00
    expect(screen.getByText('$90.00')).toBeTruthy();
    fireEvent.press(screen.getAllByText(/remove/i)[0]);
    expect(onRemove).toHaveBeenCalledWith('p1');
    fireEvent.press(screen.getByText(/checkout/i));
    expect(onCheckout).toHaveBeenCalled();
  });

  it('shows an empty state', () => {
    render(<CartView lines={[]} onSetQty={jest.fn()} onRemove={jest.fn()} onCheckout={jest.fn()} />);
    expect(screen.getByText(/cart is empty/i)).toBeTruthy();
  });
});
