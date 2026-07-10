import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/auth-provider';

// Guests get an inline sign-in prompt rather than an automatic redirect.
// Auto-navigating away inside an effect on mount tears the tab's screen down
// mid-transition, which crashes react-native-screens under the New Architecture
// ("addViewAt: … child already has a parent"). Rendering content in place — and
// navigating only on an explicit tap — keeps this screen behaving like every
// other tab.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  if (status === 'loading') return null;

  if (status === 'guest') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#EFEEE9',
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 16, color: '#17171B', marginBottom: 16, textAlign: 'center' }}>
          Log in to view your account and orders.
        </Text>
        <Pressable
          onPress={() => router.push('/(auth)/login')}
          style={{
            backgroundColor: '#2440F0',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Log in</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}
