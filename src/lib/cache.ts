import { Directory, File, Paths } from 'expo-file-system';

const cacheDir = new Directory(Paths.cache, 'axon-cache');

/**
 * Cache-first-then-refresh: lets screens render the last-known data
 * immediately on open instead of a blank/zero state while the network
 * request is in flight. Stored as plain JSON files, not SecureStore -
 * SecureStore's ~2KB value limit is too small for lists like transactions
 * or tasks, and this data isn't sensitive beyond what the API already
 * returns to the device.
 */
export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const file = new File(cacheDir, `${key}.json`);
    if (!file.exists) return null;
    const raw = await file.text();
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    cacheDir.create({ intermediates: true, idempotent: true });
    const file = new File(cacheDir, `${key}.json`);
    if (!file.exists) file.create();
    file.write(JSON.stringify(data));
  } catch {
    // Cache writes are best-effort - never block or fail the caller over this.
  }
}
