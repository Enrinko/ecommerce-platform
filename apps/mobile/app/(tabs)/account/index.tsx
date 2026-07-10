import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/auth-provider';
import { RequireAuth } from '@/components/require-auth';
import { useMyOrders } from '@/lib/orders';
import { OrdersList } from '@/components/orders-list';

function Account() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const orders = useMyOrders();

  return (
    <ScrollView style={{ backgroundColor: '#EFEEE9' }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'monospace', fontSize: 13, color: '#70707A' }}>
          {user?.email}
        </Text>
        <Pressable onPress={() => logout()}>
          <Text style={{ color: '#2440F0' }}>Log out</Text>
        </Pressable>
      </View>

      <Text style={{ marginTop: 24, fontSize: 18, fontWeight: '700', color: '#17171B' }}>
        Your orders
      </Text>
      {orders.isLoading ? (
        <Text style={{ marginTop: 12, color: '#70707A' }}>Loading…</Text>
      ) : (
        <View style={{ marginTop: 8 }}>
          <OrdersList
            orders={orders.data?.items ?? []}
            onOpen={(id) => router.push(`/orders/${id}`)}
          />
        </View>
      )}
    </ScrollView>
  );
}

export default function AccountScreen() {
  return (
    <RequireAuth>
      <Account />
    </RequireAuth>
  );
}
