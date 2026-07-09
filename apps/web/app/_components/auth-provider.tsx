'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  login as loginApi,
  logout as logoutApi,
  me as meApi,
  refresh as refreshApi,
  register as registerApi,
} from '@repo/api-client';
import type { LoginInput, MeResponse, RegisterInput } from '@repo/types';
import { setAccessToken } from '@/lib/auth-client';
import { mergeGuestCartIntoServer } from '@/lib/cart';

type Status = 'loading' | 'authed' | 'guest';
type AuthValue = {
  status: Status;
  user: MeResponse | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<MeResponse | null>(null);

  useEffect(() => {
    let active = true;
    refreshApi()
      .then(async (tokens) => {
        setAccessToken(tokens.accessToken);
        const profile = await meApi({ accessToken: tokens.accessToken });
        if (active) {
          setUser(profile);
          setStatus('authed');
        }
      })
      .catch(() => {
        if (active) {
          setAccessToken(null);
          setStatus('guest');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function establish(tokens: { accessToken: string }) {
    setAccessToken(tokens.accessToken);
    const profile = await meApi({ accessToken: tokens.accessToken });
    await mergeGuestCartIntoServer(tokens.accessToken);
    setUser(profile);
    setStatus('authed');
  }

  const value: AuthValue = {
    status,
    user,
    login: async (input) => establish(await loginApi(input)),
    register: async (input) => establish(await registerApi(input)),
    logout: async () => {
      await logoutApi({ accessToken: undefined }).catch(() => undefined);
      setAccessToken(null);
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
