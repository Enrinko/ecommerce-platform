import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { createOrderInput, type CreateOrderInput } from '@repo/types';
import { ApiError } from '@repo/api-client';
import { Field } from '@/components/field';
import { Button } from '@/components/button';
import { RequireAuth } from '@/components/require-auth';
import { useCheckout } from '@/lib/orders';

function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return 'Some items are no longer available. Please review your cart.';
    if (e.status === 400) return 'Your cart is empty.';
    return e.message;
  }
  return 'Something went wrong. Please try again.';
}

function CheckoutForm() {
  const checkout = useCheckout();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderInput) as Resolver<CreateOrderInput>,
    defaultValues: { shippingName: '', shippingAddr: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const order = await checkout.mutateAsync(values);
      router.push(`/orders/${order.id}`);
    } catch (e) {
      setError(messageFor(e));
    }
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#17171B', marginBottom: 24 }}>
        Checkout
      </Text>
      <Controller
        control={control}
        name="shippingName"
        render={({ field }) => (
          <Field
            label="Full name"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.shippingName?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="shippingAddr"
        render={({ field }) => (
          <Field
            label="Shipping address"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.shippingAddr?.message}
          />
        )}
      />
      {error ? <Text style={{ color: '#2440F0', marginBottom: 12 }}>{error}</Text> : null}
      <Button
        label={isSubmitting ? 'Placing…' : 'Place order'}
        onPress={onSubmit}
        disabled={isSubmitting}
      />
    </ScrollView>
  );
}

export default function CheckoutScreen() {
  return (
    <RequireAuth>
      <CheckoutForm />
    </RequireAuth>
  );
}
