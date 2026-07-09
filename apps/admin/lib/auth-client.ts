import { ApiError, refresh } from '@repo/api-client';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// Run an api-client call with the current access token. On a 401, refresh once
// (cookie-based) and retry; if the refresh itself fails, drop the session.
export async function authed<T>(
  call: (opts: { accessToken?: string }) => Promise<T>,
): Promise<T> {
  try {
    return await call({ accessToken: accessToken ?? undefined });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    try {
      const tokens = await refresh();
      accessToken = tokens.accessToken;
    } catch (refreshError) {
      accessToken = null;
      throw refreshError;
    }
    return call({ accessToken: accessToken ?? undefined });
  }
}
