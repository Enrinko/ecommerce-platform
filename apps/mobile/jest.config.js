module.exports = {
  preset: 'jest-expo',
  testTimeout: 30_000,
  // e2e/ holds Playwright specs (run via `test:e2e`), not Jest suites.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/', '<rootDir>/dist/'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup-after-env.ts'],
  moduleNameMapper: {
    // Force a single React instance from THIS app's nested copy (Expo SDK 57 pins
    // react@19.2.3; the hoisted root is 19.2.7; react-hook-form nests its own) —
    // otherwise "useRef of null" / version mismatch under the test renderer.
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    '^react-dom$': '<rootDir>/node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/node_modules/react-dom/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|expo-router|expo-modules-core|react-hook-form|@hookform/.*|@repo/.*)/)',
  ],
};
