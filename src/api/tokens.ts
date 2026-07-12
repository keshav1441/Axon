import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'axon_access_token';
const REFRESH_KEY = 'axon_refresh_token';

export type Tokens = { accessToken: string | null; refreshToken: string | null };

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
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
}
