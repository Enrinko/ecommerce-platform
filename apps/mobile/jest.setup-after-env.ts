import { configure } from '@testing-library/react-native';

// Runs after the test framework is installed (expect is available). Importing
// RNTL here auto-registers its matchers; give async `waitFor`s a generous budget
// so they don't flake under CPU pressure when run alongside the vitest suites.
configure({ asyncUtilTimeout: 15_000 });
