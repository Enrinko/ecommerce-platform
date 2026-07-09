'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { loginInput, registerInput, type LoginInput } from '@repo/types';
import { ApiError } from '@repo/api-client';
import { Button } from '@repo/ui';
import { useAuth } from './auth-provider';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(mode === 'login' ? loginInput : registerInput) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (mode === 'login') await auth.login(values);
      else await auth.register(values);
      router.push('/');
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Something went wrong');
    }
  });

  const label = mode === 'login' ? 'Log in' : 'Create account';
  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4">
      <h1 className="font-display text-2xl font-semibold text-ink">{label}</h1>
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
      {formError && <p className="text-sm text-accent">{formError}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {label}
      </Button>
    </form>
  );
}
