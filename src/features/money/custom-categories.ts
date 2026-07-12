import * as SecureStore from 'expo-secure-store';

const CUSTOM_KEY = 'axon_custom_categories';
const HIDDEN_KEY = 'axon_hidden_default_categories';

async function readList(key: string): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

async function writeList(key: string, list: string[]): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(list));
}

export async function getCustomCategories(): Promise<string[]> {
  return readList(CUSTOM_KEY);
}

export async function addCustomCategory(name: string): Promise<string[]> {
  const trimmed = name.trim();
  if (!trimmed) return getCustomCategories();
  const existing = await getCustomCategories();
  if (existing.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return existing;
  const next = [...existing, trimmed];
  await writeList(CUSTOM_KEY, next);
  return next;
}

export async function removeCustomCategory(name: string): Promise<string[]> {
  const existing = await getCustomCategories();
  const next = existing.filter((c) => c !== name);
  await writeList(CUSTOM_KEY, next);
  return next;
}

/** Built-in categories the user has removed - hidden rather than deleted, since they're app-defined, not stored rows. */
export async function getHiddenDefaultCategories(): Promise<string[]> {
  return readList(HIDDEN_KEY);
}

export async function hideDefaultCategory(name: string): Promise<string[]> {
  const existing = await getHiddenDefaultCategories();
  if (existing.includes(name)) return existing;
  const next = [...existing, name];
  await writeList(HIDDEN_KEY, next);
  return next;
}
