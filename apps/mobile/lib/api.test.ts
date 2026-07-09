import { ApiError, refresh } from '@repo/api-client';

jest.mock('@repo/api-client', () => {
  const actual = jest.requireActual('@repo/api-client');
  return { ...actual, refresh: jest.fn() };
});

import * as SecureStore from 'expo-secure-store';
import { authed } from './api';
import { setAccessToken } from './auth';

const mockRefresh = refresh as jest.Mock;

describe('authed', () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    (SecureStore.getItemAsync as jest.Mock).mockReset().mockResolvedValue('stored-refresh');
    (SecureStore.setItemAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
    setAccessToken('access-1');
  });

  it('passes the access token through on success', async () => {
    const call = jest.fn(async () => 'ok');
    const out = await authed(call);
    expect(out).toBe('ok');
    expect(call).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-1' }));
  });

  it('refreshes from SecureStore and retries on 401', async () => {
    const call = jest
      .fn()
      .mockRejectedValueOnce(new ApiError(401, 'Unauthorized'))
      .mockResolvedValueOnce('recovered');
    mockRefresh.mockResolvedValueOnce({ accessToken: 'access-2', refreshToken: 'refresh-2' });

    const out = await authed(call);

    expect(out).toBe('recovered');
    const refreshArgs = mockRefresh.mock.calls[0][0];
    expect(JSON.parse(refreshArgs.init.body)).toEqual({ refreshToken: 'stored-refresh' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refresh_token', 'refresh-2');
    expect(call).toHaveBeenLastCalledWith(expect.objectContaining({ accessToken: 'access-2' }));
  });
});
