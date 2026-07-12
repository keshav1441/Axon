import { apiPost } from '@/api/client';
import { setTokens, clearTokens, getTokens, setStoredUser, getStoredUser, type StoredUser } from '@/api/tokens';

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
};

const authChangeListeners = new Set<() => void>();

export function subscribeAuthChange(callback: () => void): () => void {
  authChangeListeners.add(callback);
  return () => authChangeListeners.delete(callback);
}

function notifyAuthChange() {
  for (const listener of authChangeListeners) listener();
}

export async function signup(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}): Promise<void> {
  const res = await apiPost<AuthResponse>('/api/auth/signup', input);
  await setTokens(res.accessToken, res.refreshToken);
  await setStoredUser(res.user);
  notifyAuthChange();
}

export async function login(input: { email: string; password: string }): Promise<void> {
  const res = await apiPost<AuthResponse>('/api/auth/login', input);
  await setTokens(res.accessToken, res.refreshToken);
  await setStoredUser(res.user);
  notifyAuthChange();
}

export async function logout(): Promise<void> {
  const { refreshToken } = await getTokens();
  if (refreshToken) {
    await apiPost('/api/auth/logout', { refreshToken }).catch(() => {});
  }
  await clearTokens();
  notifyAuthChange();
}

export async function isLoggedIn(): Promise<boolean> {
  const { accessToken, refreshToken } = await getTokens();
  return Boolean(accessToken && refreshToken);
}

export async function getCurrentUser(): Promise<StoredUser | null> {
  return getStoredUser();
}
