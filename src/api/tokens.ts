import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'axon_access_token';
const REFRESH_KEY = 'axon_refresh_token';
const USER_KEY = 'axon_user';

export type Tokens = { accessToken: string | null; refreshToken: string | null };
export type StoredUser = { id: string; firstName: string; lastName: string; email: string };

export async function getTokens(): Promise<Tokens> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  return { accessToken, refreshToken };
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, accessToken, { keychainAccessible: SecureStore.WHEN_UNLOCKED }),
    SecureStore.setItemAsync(REFRESH_KEY, refreshToken, { keychainAccessible: SecureStore.WHEN_UNLOCKED }),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

export async function setStoredUser(user: StoredUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getStoredUser(): Promise<StoredUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}
