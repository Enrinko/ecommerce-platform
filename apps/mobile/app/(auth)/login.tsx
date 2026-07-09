import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { loginInput, type LoginInput } from '@repo/types';
import { ApiError } from '@repo/api-client';
import { Field } from '@/components/field';
import { Button } from '@/components/button';
import { useAuth } from '@/app/_components/auth-provider';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginInput),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values);
      router.replace('/(tabs)/shop');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sign in failed');
    }
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#17171B', marginBottom: 24 }}>
        Sign in
      </Text>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Field
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.email?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <Field
            label="Password"
            secureTextEntry
            value={field.value}
            onChangeText={field.onChange}
            error={errors.password?.message}
          />
        )}
      />
      {error ? <Text style={{ color: '#2440F0', marginBottom: 12 }}>{error}</Text> : null}
      <Button label={isSubmitting ? 'Signing in…' : 'Sign in'} onPress={onSubmit} disabled={isSubmitting} />
    </ScrollView>
  );
}
