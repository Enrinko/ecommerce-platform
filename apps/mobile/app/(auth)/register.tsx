import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { registerInput, type RegisterInput } from '@repo/types';
import { ApiError } from '@repo/api-client';
import { Field } from '@/components/field';
import { Button } from '@/components/button';
import { useAuth } from '@/components/auth-provider';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerInput),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await register(values);
      router.replace('/(tabs)/shop');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sign up failed');
    }
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#17171B', marginBottom: 24 }}>
        Create account
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
      <Button
        label={isSubmitting ? 'Creating…' : 'Create account'}
        onPress={onSubmit}
        disabled={isSubmitting}
      />
    </ScrollView>
  );
}
