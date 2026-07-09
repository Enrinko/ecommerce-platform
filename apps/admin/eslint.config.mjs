import base from '@repo/config/eslint';

export default [...base, { ignores: ['next-env.d.ts', '.next/**'] }];
