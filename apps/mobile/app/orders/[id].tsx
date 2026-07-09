import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useOrder } from '@/lib/orders';
import { OrderSummary } from '@/components/order-summary';
import { RequireAuth } from '@/components/require-auth';

function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);

  if (order.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (order.isError || !order.data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#70707A' }}>Order not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView>
      <Text
        style={{ fontSize: 22, fontWeight: '700', color: '#17171B', padding: 16, paddingBottom: 0 }}
      >
        Order confirmed
      </Text>
      <OrderSummary order={order.data} />
    </ScrollView>
  );
}

export default function OrderDetailScreen() {
  return (
    <RequireAuth>
      <OrderDetail />
    </RequireAuth>
  );
}
