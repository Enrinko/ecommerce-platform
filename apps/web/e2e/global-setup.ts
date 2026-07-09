import { execFileSync } from 'node:child_process';

// Ensure the API's databases are migrated and seeded before the run.
// Commands are hardcoded (no external input) and run without a shell.
export default function globalSetup() {
  execFileSync('pnpm', ['--filter', 'api', 'exec', 'prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
  });
  execFileSync('pnpm', ['--filter', 'api', 'db:seed'], { stdio: 'inherit' });
}
