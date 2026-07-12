import { getTokens, setTokens, clearTokens } from './tokens';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken } = await getTokens();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await clearTokens();
    return false;
  }
  const data = await res.json();
  await setTokens(data.accessToken, data.refreshToken);
  return true;
}

async function rawFetch(path: string, options: RequestInit, accessToken: string | null): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { accessToken } = await getTokens();
  let res = await rawFetch(path, options, accessToken);

  if (res.status === 401 && accessToken) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      const { accessToken: newToken } = await getTokens();
      res = await rawFetch(path, options, newToken);
    }
  }

  return res;
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText, code: 'UNKNOWN' }));
    throw new ApiError(res.status, body.code ?? 'UNKNOWN', body.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  return handleJson<T>(await apiFetch(path, { method: 'GET' }));
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return handleJson<T>(await apiFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }));
}

export async function apiDelete<T>(path: string): Promise<T> {
  return handleJson<T>(await apiFetch(path, { method: 'DELETE' }));
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return handleJson<T>(await apiFetch(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }));
}
