import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

type IconName = keyof typeof Ionicons.glyphMap;
const tabIcon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );

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
      <Tabs.Screen
        name="shop"
        options={{ title: 'Shop', headerShown: false, tabBarIcon: tabIcon('storefront-outline') }}
      />
      <Tabs.Screen
        name="cart"
        options={{ title: 'Cart', tabBarIcon: tabIcon('cart-outline') }}
      />
      <Tabs.Screen
        name="account/index"
        options={{ title: 'Account', tabBarIcon: tabIcon('person-outline') }}
      />
    </Tabs>
  );
}
