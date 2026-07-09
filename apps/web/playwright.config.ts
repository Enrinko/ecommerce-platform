import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  // Slow CI runners need generous assertion budgets (argon2 hashing on register,
  // cold next-dev compilation, multiple API round-trips per navigation).
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: isCI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './e2e/global-setup.ts',
  webServer: [
    {
      command: 'pnpm --filter api start:dev',
      url: 'http://localhost:3000/api/v1/health',
      timeout: 120_000,
      reuseExistingServer: !isCI,
    },
    {
      command: 'pnpm --filter web dev',
      url: 'http://localhost:3001',
      timeout: 120_000,
      reuseExistingServer: !isCI,
    },
  ],
});
