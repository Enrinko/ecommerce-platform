import type { Metadata } from 'next';
import { AuthForm } from '@/app/_components/auth-form';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <main className="px-4 py-16">
      <AuthForm mode="login" />
      <p className="mx-auto mt-4 max-w-sm text-sm text-graphite">
        No account?{' '}
        <a href="/register" className="text-accent hover:underline">
          Create one
        </a>
      </p>
    </main>
  );
}
