import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./auth-provider', () => ({
  useAuth: () => ({ login: vi.fn(), register: vi.fn(), status: 'guest' }),
}));

import { AuthForm } from './auth-form';

describe('AuthForm', () => {
  it('renders email + password fields and a submit button for login', () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });
});
