import { useEffect } from 'react';

import { flushPendingFocusSessions } from '@/features/focus/api';
import { pushFocusConfigToNative } from '@/features/focus/config';

/**
 * Mounted once at the app root. Only pushes the distraction-app list to
 * native (so the accessibility service knows what to block during Focus
 * Mode) and retries any queued Focus Mode session writes - per-app usage
 * is no longer tracked or stored, by design: no timers, no history for
 * individual distraction apps, only completed Focus Mode sessions matter.
 */
export function useFocusSessionTracking() {
  useEffect(() => {
    pushFocusConfigToNative();
    flushPendingFocusSessions();
  }, []);
}
