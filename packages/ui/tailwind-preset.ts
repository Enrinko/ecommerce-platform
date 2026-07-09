import type { Config } from 'tailwindcss';

// Shared design tokens for web (and later admin). Apps extend this preset.
const preset = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4f46e5',
          fg: '#ffffff',
        },
      },
      borderRadius: { md: '0.5rem' },
    },
  },
} satisfies Partial<Config>;

export default preset;
