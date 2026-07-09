import type { Metadata } from 'next';
import { AuthForm } from '@/app/_components/auth-form';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <main className="px-4 py-16">
      <AuthForm mode="register" />
      <p className="mx-auto mt-4 max-w-sm text-sm text-graphite">
        Have an account?{' '}
        <a href="/login" className="text-accent hover:underline">
          Log in
        </a>
      </p>
    </main>
  );
}
