import type { AuthTokens, LoginInput, MeResponse, RegisterInput } from '@repo/types';
import { apiFetch, type RequestOptions } from './http';

const post = (body: unknown, opts?: RequestOptions): RequestOptions => ({
  ...opts,
  init: { ...opts?.init, method: 'POST', body: JSON.stringify(body) },
});

export function register(input: RegisterInput, opts?: RequestOptions): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/register', post(input, opts));
}
export function login(input: LoginInput, opts?: RequestOptions): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/login', post(input, opts));
}
export function refresh(opts?: RequestOptions): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/refresh', { ...opts, init: { ...opts?.init, method: 'POST' } });
}
export function logout(opts?: RequestOptions): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/auth/logout', { ...opts, init: { ...opts?.init, method: 'POST' } });
}
export function me(opts?: RequestOptions): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me', opts);
}
