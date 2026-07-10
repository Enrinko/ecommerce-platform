import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }));

let mockStatus = 'guest';
jest.mock('@/components/auth-provider', () => ({ useAuth: () => ({ status: mockStatus }) }));

import { RequireAuth } from '@/components/require-auth';

const Child = () => <Text>secret content</Text>;

beforeEach(() => {
  mockReplace.mockReset();
  mockPush.mockReset();
});

it('renders children when authed', () => {
  mockStatus = 'authed';
  render(
    <RequireAuth>
      <Child />
    </RequireAuth>,
  );
  expect(screen.getByText('secret content')).toBeTruthy();
});

it('renders nothing while auth is loading', () => {
  mockStatus = 'loading';
  render(
    <RequireAuth>
      <Child />
    </RequireAuth>,
  );
  expect(screen.queryByText('secret content')).toBeNull();
});

it('shows a sign-in prompt for guests WITHOUT auto-navigating', () => {
  // Auto-redirecting away on mount tears the tab screen down mid-transition and
  // crashes react-native-screens under Fabric ("child already has a parent").
  // A guest must instead see inline content, like every other tab.
  mockStatus = 'guest';
  render(
    <RequireAuth>
      <Child />
    </RequireAuth>,
  );
  expect(screen.queryByText('secret content')).toBeNull();
  expect(screen.getByText('Log in')).toBeTruthy(); // the button (exact, not the prompt sentence)
  expect(mockReplace).not.toHaveBeenCalled(); // no navigation during render/mount
});

it('navigates to login only when the guest taps the button', () => {
  mockStatus = 'guest';
  render(
    <RequireAuth>
      <Child />
    </RequireAuth>,
  );
  expect(mockPush).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Log in'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
});
