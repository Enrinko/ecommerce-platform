import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'refresh_token';
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}
export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}
export function setRefreshToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(REFRESH_KEY, token);
}
export function clearRefreshToken(): Promise<void> {
  return SecureStore.deleteItemAsync(REFRESH_KEY);
}
