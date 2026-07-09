import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  login as loginApi,
  logout as logoutApi,
  me as meApi,
  refresh as refreshApi,
  register as registerApi,
} from '@repo/api-client';
import type { LoginInput, MeResponse, RegisterInput } from '@repo/types';
import { API_BASE } from '@/lib/api';
import { clearRefreshToken, getRefreshToken, setAccessToken, setRefreshToken } from '@/lib/auth';

type Status = 'loading' | 'authed' | 'guest';
type AuthValue = {
  status: Status;
  user: MeResponse | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);
const body = (refreshToken: string) => ({
  baseUrl: API_BASE,
  init: { body: JSON.stringify({ refreshToken }) },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<MeResponse | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const rt = await getRefreshToken();
      if (!rt) {
        if (active) setStatus('guest');
        return;
      }
      try {
        const tokens = await refreshApi(body(rt));
        setAccessToken(tokens.accessToken);
        await setRefreshToken(tokens.refreshToken);
        const profile = await meApi({ baseUrl: API_BASE, accessToken: tokens.accessToken });
        if (!active) return;
        setUser(profile);
        setStatus('authed');
      } catch {
        setAccessToken(null);
        await clearRefreshToken();
        if (active) setStatus('guest');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function establish(tokens: { accessToken: string; refreshToken: string }) {
    setAccessToken(tokens.accessToken);
    await setRefreshToken(tokens.refreshToken);
    const profile = await meApi({ baseUrl: API_BASE, accessToken: tokens.accessToken });
    setUser(profile);
    setStatus('authed');
  }

  const value: AuthValue = {
    status,
    user,
    login: async (input) => establish(await loginApi(input, { baseUrl: API_BASE })),
    register: async (input) => establish(await registerApi(input, { baseUrl: API_BASE })),
    logout: async () => {
      const rt = await getRefreshToken();
      await logoutApi(rt ? body(rt) : { baseUrl: API_BASE }).catch(() => undefined);
      setAccessToken(null);
      await clearRefreshToken();
      setUser(null);
      setStatus('guest');
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
