import { Text, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';

const tabIcon =
  (emoji: string) =>
  ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 20, color }}>{emoji}</Text>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#EFEEE9' },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: '#17171B', fontSize: 18 },
        tabBarActiveTintColor: '#2440F0',
        tabBarInactiveTintColor: '#70707A',
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#DAD8D1', borderTopWidth: 1 },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="shop/index" options={{ title: 'Shop', tabBarIcon: tabIcon('🛍') }} />
      <Tabs.Screen name="cart" options={{ title: 'Cart', tabBarIcon: tabIcon('🛒') }} />
      <Tabs.Screen name="account/index" options={{ title: 'Account', tabBarIcon: tabIcon('👤') }} />
    </Tabs>
  );
}
