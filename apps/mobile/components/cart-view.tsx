import { Pressable, Text, View } from 'react-native';
import { Price } from '@/components/price';
import { Button } from '@/components/button';

export type CartLine = {
  productId: string;
  title: string;
  priceCents: number;
  currency: string;
  qty: number;
};

export function CartView({
  lines,
  onSetQty,
  onRemove,
  onCheckout,
}: {
  lines: CartLine[];
  onSetQty: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
}) {
  if (lines.length === 0) {
    return <Text style={{ color: '#70707A', padding: 16 }}>Your cart is empty.</Text>;
  }
  const total = lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0);
  const currency = lines[0].currency;

  return (
    <View style={{ padding: 16 }}>
      {lines.map((l) => (
        <View
          key={l.productId}
          style={{ borderBottomWidth: 1, borderBottomColor: '#DAD8D1', paddingVertical: 12 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#17171B' }}>{l.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 16 }}>
            <Pressable onPress={() => onSetQty(l.productId, l.qty - 1)}>
              <Text style={{ fontSize: 18, color: '#2440F0' }}>−</Text>
            </Pressable>
            <Text style={{ minWidth: 24, textAlign: 'center' }}>{l.qty}</Text>
            <Pressable onPress={() => onSetQty(l.productId, l.qty + 1)}>
              <Text style={{ fontSize: 18, color: '#2440F0' }}>+</Text>
            </Pressable>
            <Price cents={l.priceCents * l.qty} currency={l.currency} />
            <Pressable onPress={() => onRemove(l.productId)}>
              <Text style={{ color: '#70707A' }}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <Text style={{ fontWeight: '600', color: '#17171B' }}>Total</Text>
        <Price cents={total} currency={currency} style={{ fontSize: 18, fontWeight: '600' }} />
      </View>
      <View style={{ marginTop: 16 }}>
        <Button label="Checkout" onPress={onCheckout} />
      </View>
    </View>
  );
}
