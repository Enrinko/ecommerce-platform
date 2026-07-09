import { useGuestCart } from '@/lib/guest-cart';

const line = {
  productId: 'p1',
  slug: 'usb-c-cable',
  title: 'USB-C Cable',
  priceCents: 2500,
  currency: 'USD',
};

beforeEach(() => useGuestCart.setState({ items: [] }));

describe('useGuestCart', () => {
  it('adds and increments quantity', () => {
    useGuestCart.getState().add(line);
    useGuestCart.getState().add(line, 2);
    const items = useGuestCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].qty).toBe(3);
  });
  it('sets quantity and removes at zero', () => {
    useGuestCart.getState().add(line);
    useGuestCart.getState().setQty('p1', 5);
    expect(useGuestCart.getState().items[0].qty).toBe(5);
    useGuestCart.getState().setQty('p1', 0);
    expect(useGuestCart.getState().items).toHaveLength(0);
  });
  it('removes and clears', () => {
    useGuestCart.getState().add(line);
    useGuestCart.getState().remove('p1');
    expect(useGuestCart.getState().items).toHaveLength(0);
    useGuestCart.getState().add(line);
    useGuestCart.getState().clear();
    expect(useGuestCart.getState().items).toHaveLength(0);
  });
});
