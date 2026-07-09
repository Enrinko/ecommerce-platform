import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { refresh, me, login, register, logout } from '@repo/api-client';

jest.mock('@repo/api-client', () => {
  const actual = jest.requireActual('@repo/api-client');
  return {
    ...actual,
    refresh: jest.fn(),
    me: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
  };
});

import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '@/components/auth-provider';

const mockRefresh = refresh as jest.Mock;
const mockMe = me as jest.Mock;

function Probe() {
  const { status, user } = useAuth();
  return (
    <Text>
      {status}:{user?.email ?? '-'}
    </Text>
  );
}

beforeEach(() => {
  [refresh, me, login, register, logout].forEach((m) => (m as jest.Mock).mockReset());
  (SecureStore.getItemAsync as jest.Mock).mockReset();
  (SecureStore.setItemAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
});

it('authes an existing session via silent refresh', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-refresh');
  mockRefresh.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
  mockMe.mockResolvedValueOnce({ id: 'u1', email: 'a@x.io', role: 'CUSTOMER' });
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByText('authed:a@x.io')).toBeTruthy());
});

it('falls back to guest with no stored refresh token', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByText('guest:-')).toBeTruthy());
});
