import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './index';

describe('Button', () => {
  it('renders its children as a button', () => {
    render(<Button>Buy now</Button>);
    expect(screen.getByRole('button', { name: 'Buy now' })).toBeInTheDocument();
  });

  it('applies an outline variant class', () => {
    render(<Button variant="outline">Cancel</Button>);
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('border');
  });

  it('merges a caller className', () => {
    render(<Button className="w-full">Wide</Button>);
    expect(screen.getByRole('button', { name: 'Wide' }).className).toContain('w-full');
  });
});
