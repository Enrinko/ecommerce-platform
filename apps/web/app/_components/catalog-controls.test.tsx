import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

import { CatalogControls } from './catalog-controls';

describe('CatalogControls', () => {
  it('renders category options and the sort control', () => {
    render(
      <CatalogControls
        categories={[{ id: 'c1', name: 'Audio', slug: 'audio' }]}
        current={{ page: 1, limit: 20, sort: 'newest' } as never}
      />,
    );
    expect(screen.getByRole('option', { name: 'Audio' })).toBeInTheDocument();
    expect(screen.getByLabelText(/sort/i)).toBeInTheDocument();
  });
});
