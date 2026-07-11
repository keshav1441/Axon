import { useEffect, useRef } from 'react';

import { recordFocusSession } from '@/db/focus';
import { focusConfigCache, pushFocusConfigToNative } from '@/features/focus/config';
import { subscribeForegroundApp } from '@/native/axon-native';

/** Mounted once at the app root - turns foreground-app-change events into completed focus_sessions rows. */
export function useFocusSessionTracking() {
  const activeSession = useRef<{ packageName: string; startedAt: number } | null>(null);

  useEffect(() => {
    pushFocusConfigToNative();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeForegroundApp(({ packageName, timestampMs }) => {
      const current = activeSession.current;
      if (current && current.packageName !== packageName) {
        recordFocusSession(current.packageName, current.startedAt, timestampMs);
        activeSession.current = null;
      }
      if (focusConfigCache.distractionPackages.has(packageName) && !activeSession.current) {
        activeSession.current = { packageName, startedAt: timestampMs };
      }
    });
    return unsubscribe;
  }, []);
}
