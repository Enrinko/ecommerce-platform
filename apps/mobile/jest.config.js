module.exports = {
  preset: 'jest-expo',
  // e2e/ holds Playwright specs (run via `test:e2e`), not Jest suites.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/', '<rootDir>/dist/'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // Force a single React instance: react-hook-form ships a nested react copy,
    // whose dispatcher is null under the test renderer → "useRef of null".
    '^react$': '<rootDir>/../../node_modules/react',
    '^react/(.*)$': '<rootDir>/../../node_modules/react/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|expo-router|expo-modules-core|react-hook-form|@hookform/.*|@repo/.*)/)',
  ],
};
