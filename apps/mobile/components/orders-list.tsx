import { Pressable, Text, View } from 'react-native';
import { Price } from '@/components/price';
import { orderStatusLabel } from '@/lib/orders';

export type OrderRow = { id: string; status: string; totalCents: number; currency: string };

export function OrdersList({
  orders,
  onOpen,
}: {
  orders: OrderRow[];
  onOpen: (id: string) => void;
}) {
  if (orders.length === 0) {
    return <Text style={{ color: '#70707A', padding: 16 }}>You have no orders yet.</Text>;
  }
  return (
    <View>
      {orders.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onOpen(o.id)}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: '#DAD8D1',
          }}
        >
          <Text style={{ fontFamily: 'monospace', color: '#70707A' }}>{o.id.slice(0, 8)}</Text>
          <Text style={{ fontSize: 12, textTransform: 'uppercase', color: '#17171B' }}>
            {orderStatusLabel(o.status)}
          </Text>
          <Price cents={o.totalCents} currency={o.currency} />
        </Pressable>
      ))}
    </View>
  );
}
