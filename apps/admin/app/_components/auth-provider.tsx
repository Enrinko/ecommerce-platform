'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { login as loginApi, logout as logoutApi, me as meApi, refresh as refreshApi } from '@repo/api-client';
import type { LoginInput, MeResponse } from '@repo/types';
import { setAccessToken } from '@/lib/auth-client';

type Status = 'loading' | 'authed' | 'guest';
type AuthValue = {
  status: Status;
  user: MeResponse | null;
  login: (input: LoginInput) => Promise<void>;
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
        if (!active) return;
        if (profile.role === 'ADMIN') {
          setUser(profile);
          setStatus('authed');
        } else {
          setAccessToken(null);
          setStatus('guest');
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

  const value: AuthValue = {
    status,
    user,
    login: async (input) => {
      const tokens = await loginApi(input);
      setAccessToken(tokens.accessToken);
      const profile = await meApi({ accessToken: tokens.accessToken });
      if (profile.role !== 'ADMIN') {
        setAccessToken(null);
        throw new Error('This account does not have admin access.');
      }
      setUser(profile);
      setStatus('authed');
    },
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
