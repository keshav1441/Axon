import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import AxonNative from '../../modules/axon-native/src/AxonNativeModule';
import type {
  ForegroundAppChangedEvent,
  OverlayActionEvent,
  SmsReceivedEvent,
  UpiNotificationEvent,
} from '../../modules/axon-native/src/AxonNative.types';

export { AxonNative };
export type { ForegroundAppChangedEvent, OverlayActionEvent, SmsReceivedEvent, UpiNotificationEvent };

export type PermissionKind =
  | 'sms'
  | 'notificationAccess'
  | 'overlay'
  | 'accessibility'
  | 'usageAccess';

function checkPermission(kind: PermissionKind): boolean {
  switch (kind) {
    case 'sms':
      return AxonNative.hasSmsPermission();
    case 'notificationAccess':
      return AxonNative.hasNotificationAccess();
    case 'overlay':
      return AxonNative.hasOverlayPermission();
    case 'accessibility':
      return AxonNative.hasAccessibilityServiceEnabled();
    case 'usageAccess':
      return AxonNative.hasUsageAccess();
  }
}

function requestPermission(kind: PermissionKind) {
  switch (kind) {
    case 'sms':
      return AxonNative.requestSmsPermission();
    case 'notificationAccess':
      return AxonNative.openNotificationAccessSettings();
    case 'overlay':
      return AxonNative.requestOverlayPermission();
    case 'accessibility':
      return AxonNative.openAccessibilitySettings();
    case 'usageAccess':
      return AxonNative.openUsageAccessSettings();
  }
}

/**
 * All Axon permissions are granted through a system dialog or Settings
 * screen the OS owns - there's no grant callback to await. Instead this
 * re-checks status whenever the app comes back to the foreground, which is
 * when the user would have just returned from granting it.
 */
export function usePermissionStatus(kind: PermissionKind) {
  const [granted, setGranted] = useState(() => checkPermission(kind));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setGranted(checkPermission(kind));
    });
    return () => sub.remove();
  }, [kind]);

  const request = useCallback(() => requestPermission(kind), [kind]);

  return { granted, request };
}

export function subscribeSms(callback: (event: SmsReceivedEvent) => void) {
  const sub = AxonNative.addListener('onSmsReceived', callback);
  return () => sub.remove();
}

export function subscribeUpiNotification(callback: (event: UpiNotificationEvent) => void) {
  const sub = AxonNative.addListener('onUpiNotification', callback);
  return () => sub.remove();
}

export function subscribeForegroundApp(callback: (event: ForegroundAppChangedEvent) => void) {
  const sub = AxonNative.addListener('onForegroundAppChanged', callback);
  return () => sub.remove();
}

export function subscribeOverlayAction(callback: (event: OverlayActionEvent) => void) {
  const sub = AxonNative.addListener('onOverlayAction', callback);
  return () => sub.remove();
}
