import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: isCI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
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
      command: 'pnpm --filter mobile exec expo start --web --port 8081',
      url: 'http://localhost:8081',
      timeout: 180_000,
      reuseExistingServer: !isCI,
      // Enables the localStorage-backed refresh-token path for the web E2E build
      // only (gated in lib/auth.ts); production web never persists the token.
      env: { EXPO_PUBLIC_E2E: '1' },
    },
  ],
});
