import { ApiError, refresh } from '@repo/api-client';
import {
  clearRefreshToken,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './auth';

export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export async function authed<T>(
  call: (opts: { baseUrl: string; accessToken?: string }) => Promise<T>,
): Promise<T> {
  try {
    return await call({ baseUrl: API_BASE, accessToken: getAccessToken() ?? undefined });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    const rt = await getRefreshToken();
    if (!rt) throw e;
    try {
      const tokens = await refresh({
        baseUrl: API_BASE,
        init: { body: JSON.stringify({ refreshToken: rt }) },
      });
      setAccessToken(tokens.accessToken);
      await setRefreshToken(tokens.refreshToken);
    } catch (refreshError) {
      setAccessToken(null);
      await clearRefreshToken();
      throw refreshError;
    }
    return call({ baseUrl: API_BASE, accessToken: getAccessToken() ?? undefined });
  }
}
