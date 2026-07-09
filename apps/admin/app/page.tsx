import { AdminShell } from './_components/admin-shell';

export default function DashboardPage() {
  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>
      <p className="mt-2 text-graphite">Metrics arrive in M4.</p>
    </AdminShell>
  );
}
