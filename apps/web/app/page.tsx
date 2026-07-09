import { Button } from '@repo/ui';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Storefront</h1>
      <p className="mt-2 text-sm">Phase 2 foundation is up.</p>
      <Button className="mt-4">Shop now</Button>
    </main>
  );
}
