import { Text, View } from 'react-native';
import type { Order } from '@repo/api-client';
import { Price } from '@/components/price';
import { orderStatusLabel } from '@/lib/orders';

export function OrderSummary({ order }: { order: Order }) {
  return (
    <View style={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: 'monospace', color: '#70707A' }}>{order.id.slice(0, 8)}</Text>
        <Text style={{ fontSize: 12, textTransform: 'uppercase', color: '#17171B' }}>
          {orderStatusLabel(order.status)}
        </Text>
      </View>

      <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#DAD8D1' }}>
        {order.items.map((it) => (
          <View
            key={it.id}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#DAD8D1',
            }}
          >
            <Text style={{ color: '#17171B' }}>
              {it.titleSnapshot} × {it.qty}
            </Text>
            <Price cents={it.priceCentsSnapshot * it.qty} currency={order.currency} />
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <Text style={{ fontWeight: '600', color: '#17171B' }}>Total</Text>
        <Price cents={order.totalCents} currency={order.currency} style={{ fontWeight: '600' }} />
      </View>

      <Text style={{ marginTop: 16, color: '#70707A' }}>
        Ship to: {order.shippingName}, {order.shippingAddr}
      </Text>
    </View>
  );
}
