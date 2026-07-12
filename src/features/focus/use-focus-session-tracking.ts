import { useEffect, useRef } from 'react';

import { flushPendingFocusSessions, recordFocusSession } from '@/features/focus/api';
import { focusConfigCache, pushFocusConfigToNative } from '@/features/focus/config';
import { subscribeForegroundApp } from '@/native/axon-native';

/** Mounted once at the app root - turns foreground-app-change events into completed focus_sessions rows. */
export function useFocusSessionTracking() {
  const activeSession = useRef<{ packageName: string; startedAt: number } | null>(null);

  useEffect(() => {
    pushFocusConfigToNative();
    flushPendingFocusSessions();
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
