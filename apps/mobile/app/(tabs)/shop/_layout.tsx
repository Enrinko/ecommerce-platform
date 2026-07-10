import { Stack } from 'expo-router';

export default function ShopLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#EFEEE9' },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: '#17171B' },
        headerTintColor: '#2440F0',
        contentStyle: { backgroundColor: '#EFEEE9' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Shop' }} />
      <Stack.Screen name="[slug]" options={{ title: 'Product' }} />
    </Stack>
  );
}
