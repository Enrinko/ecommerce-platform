import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'refresh_token';
let accessToken: string | null = null;

// expo-secure-store is native-only. On web (used for Expo Web E2E) fall back to
// localStorage so the refresh-token store works across the whole auth flow.
const isWeb = Platform.OS === 'web';

export function getAccessToken(): string | null {
  return accessToken;
}
export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getRefreshToken(): Promise<string | null> {
  if (isWeb) return Promise.resolve(globalThis.localStorage?.getItem(REFRESH_KEY) ?? null);
  return SecureStore.getItemAsync(REFRESH_KEY);
}
export function setRefreshToken(token: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(REFRESH_KEY, token);
    return Promise.resolve();
  }
  return SecureStore.setItemAsync(REFRESH_KEY, token);
}
export function clearRefreshToken(): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(REFRESH_KEY);
    return Promise.resolve();
  }
  return SecureStore.deleteItemAsync(REFRESH_KEY);
}
