import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'refresh_token';
let accessToken: string | null = null;

// expo-secure-store is native-only. The web target exists ONLY for Expo Web E2E
// (never a shipped surface — the real app is native, spec §2/§10). Persisting the
// refresh token in localStorage is therefore gated behind an explicit E2E flag so
// a production web bundle never writes a token to XSS-reachable storage.
const isWeb = Platform.OS === 'web';
const isE2EWeb = isWeb && process.env.EXPO_PUBLIC_E2E === '1';

export function getAccessToken(): string | null {
  return accessToken;
}
export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getRefreshToken(): Promise<string | null> {
  if (isWeb) {
    return Promise.resolve(isE2EWeb ? (globalThis.localStorage?.getItem(REFRESH_KEY) ?? null) : null);
  }
  return SecureStore.getItemAsync(REFRESH_KEY);
}
export function setRefreshToken(token: string): Promise<void> {
  if (isWeb) {
    // Production web (no E2E flag): do not persist the refresh token anywhere.
    if (isE2EWeb) globalThis.localStorage?.setItem(REFRESH_KEY, token);
    return Promise.resolve();
  }
  return SecureStore.setItemAsync(REFRESH_KEY, token);
}
export function clearRefreshToken(): Promise<void> {
  if (isWeb) {
    if (isE2EWeb) globalThis.localStorage?.removeItem(REFRESH_KEY);
    return Promise.resolve();
  }
  return SecureStore.deleteItemAsync(REFRESH_KEY);
}
