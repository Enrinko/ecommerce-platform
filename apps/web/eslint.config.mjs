import base from '@repo/config/eslint';

export default [
  ...base,
  // Next regenerates next-env.d.ts (with triple-slash refs it mandates) on build.
  { ignores: ['next-env.d.ts', '.next/**'] },
];
