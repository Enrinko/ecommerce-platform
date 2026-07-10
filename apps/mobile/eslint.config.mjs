import base from '@repo/config/eslint';

export default [
  ...base,
  {
    // Metro/Babel/Jest configs are Node CommonJS — require() is intentional there.
    ignores: [
      '.expo/**',
      'dist/**',
      'web-build/**',
      'test-results/**',
      'expo-env.d.ts',
      'metro.config.js',
      'babel.config.js',
      'jest.config.js',
      // jest.mock factories must use require() (hoisting), not import.
      'jest.setup.ts',
      // Expo config plugins are Node CommonJS — Expo's loader require()s them.
      'plugins/**',
    ],
  },
];
