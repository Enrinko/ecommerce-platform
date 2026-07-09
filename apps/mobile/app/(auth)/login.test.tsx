import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
const mockLogin = jest.fn();
jest.mock('@/app/_components/auth-provider', () => ({ useAuth: () => ({ login: mockLogin }) }));

import LoginScreen from './login';

beforeEach(() => {
  mockReplace.mockReset();
  mockLogin.mockReset().mockResolvedValue(undefined);
});

it('submits credentials and navigates on success', async () => {
  render(<LoginScreen />);
  fireEvent.changeText(screen.getByLabelText(/email/i), 'user@example.com');
  fireEvent.changeText(screen.getByLabelText(/password/i), 'secret123');
  fireEvent.press(screen.getByRole('button', { name: /sign in/i }));

  await waitFor(() =>
    expect(mockLogin).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret123' }),
  );
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/shop'));
});

it('shows a validation error for a bad email', async () => {
  render(<LoginScreen />);
  fireEvent.changeText(screen.getByLabelText(/email/i), 'nope');
  fireEvent.changeText(screen.getByLabelText(/password/i), 'secret123');
  fireEvent.press(screen.getByRole('button', { name: /sign in/i }));

  await waitFor(() => expect(screen.getByText(/invalid|email/i)).toBeTruthy());
  expect(mockLogin).not.toHaveBeenCalled();
});
