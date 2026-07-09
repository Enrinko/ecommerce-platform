import type { Config } from 'tailwindcss';

// "Measured" — a precision-instrument identity for an everyday-tech shop.
const preset = {
  theme: {
    extend: {
      colors: {
        paper: '#EFEEE9',
        surface: '#FFFFFF',
        ink: '#17171B',
        graphite: '#70707A',
        hairline: '#DAD8D1',
        accent: { DEFAULT: '#2440F0', ink: '#FFFFFF' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { sm: '2px', md: '4px' },
    },
  },
} satisfies Partial<Config>;

export default preset;
