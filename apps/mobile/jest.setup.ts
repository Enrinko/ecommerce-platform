import { configure } from '@testing-library/react-native';

// jest-expo suites run alongside the web/admin vitest suites under `turbo test`;
// give async `waitFor`s a generous budget so they don't flake under CPU pressure.
configure({ asyncUtilTimeout: 15_000 });

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
