import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The app's tsconfig uses jsx: "preserve" (required by Next), so esbuild would
  // otherwise fall back to the classic runtime and JSX in tests would need React
  // in scope. Force the automatic runtime for test transforms.
  esbuild: { jsx: 'automatic' },
  resolve: {
    // zustand (shared with apps/mobile, which pins React 18.3) nests its own react
    // copy; alias react/react-dom to the single hoisted React 19 so tests don't hit
    // a second instance ("useCallback of null").
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      react: fileURLToPath(new URL('../../node_modules/react', import.meta.url)),
      'react-dom': fileURLToPath(new URL('../../node_modules/react-dom', import.meta.url)),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    // Run zustand through vite's pipeline so the react alias/dedupe above applies
    // to its imports (it nests its own react copy in this mixed React 18/19 repo).
    server: { deps: { inline: ['zustand'] } },
  },
});
