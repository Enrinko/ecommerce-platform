'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { loginInput, type LoginInput } from '@repo/types';
import { ApiError } from '@repo/api-client';
import { Button } from '@repo/ui';
import { useAuth } from '@/app/_components/auth-provider';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginInput) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values);
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Login failed');
    }
  });

  return (
    <main className="mx-auto mt-24 max-w-sm">
      <h1 className="font-display text-2xl font-semibold text-ink">Admin sign in</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="text-graphite">Email</span>
          <input
            type="email"
            {...register('email')}
            className="mt-1 w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-ink"
          />
          {errors.email && <span className="text-sm text-accent">{errors.email.message}</span>}
        </label>
        <label className="block text-sm">
          <span className="text-graphite">Password</span>
          <input
            type="password"
            {...register('password')}
            className="mt-1 w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-ink"
          />
          {errors.password && <span className="text-sm text-accent">{errors.password.message}</span>}
        </label>
        {error && <p className="text-sm text-accent">{error}</p>}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          Sign in
        </Button>
      </form>
    </main>
  );
}
