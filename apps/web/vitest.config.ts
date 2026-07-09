import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The app's tsconfig uses jsx: "preserve" (required by Next), so esbuild would
  // otherwise fall back to the classic runtime and JSX in tests would need React
  // in scope. Force the automatic runtime for test transforms.
  esbuild: { jsx: 'automatic' },
  test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'], globals: true },
});
