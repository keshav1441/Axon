import * as SecureStore from 'expo-secure-store';

const FOCUS_MODE_STATE_KEY = 'axon_focus_mode_state';

/** Sentinel "package" identifying a Focus Mode block session in focus_sessions, distinct from real per-app usage tracking. */
export const FOCUS_MODE_SESSION_PACKAGE = 'axon.focus_mode_block';

export type FocusModeState = { startedAt: number; until: number; plannedMinutes: number };

/**
 * The native overlay/foreground service keeps running independent of any JS
 * screen's lifecycle - only the JS timer that knows when to stop it lives in
 * component state. Persisting this here lets any remount (e.g. after
 * navigating home and back) restore the correct "still active" UI instead of
 * looking like Focus Mode never started, and lets the eventual stop record an
 * accurate completed-session row.
 */
export async function getPersistedFocusModeState(): Promise<FocusModeState | null> {
  const raw = await SecureStore.getItemAsync(FOCUS_MODE_STATE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.startedAt === 'number' && typeof parsed.until === 'number' && typeof parsed.plannedMinutes === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setPersistedFocusModeState(state: FocusModeState): Promise<void> {
  await SecureStore.setItemAsync(FOCUS_MODE_STATE_KEY, JSON.stringify(state));
}

export async function clearPersistedFocusModeState(): Promise<void> {
  await SecureStore.deleteItemAsync(FOCUS_MODE_STATE_KEY);
}
