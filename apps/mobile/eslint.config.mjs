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
    ],
  },
];
