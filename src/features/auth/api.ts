import { apiPost } from '@/api/client';
import { setTokens, clearTokens, getTokens } from '@/api/tokens';

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; firstName: string; lastName: string; email: string };
};

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
}

export async function login(input: { email: string; password: string }): Promise<void> {
  const res = await apiPost<AuthResponse>('/api/auth/login', input);
  await setTokens(res.accessToken, res.refreshToken);
}

export async function logout(): Promise<void> {
  const { refreshToken } = await getTokens();
  if (refreshToken) {
    await apiPost('/api/auth/logout', { refreshToken }).catch(() => {});
  }
  await clearTokens();
}

export async function isLoggedIn(): Promise<boolean> {
  const { accessToken, refreshToken } = await getTokens();
  return Boolean(accessToken && refreshToken);
}
