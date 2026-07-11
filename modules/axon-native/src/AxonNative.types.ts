export type SmsReceivedEvent = {
  sender: string;
  body: string;
  timestampMs: number;
};

export type UpiNotificationEvent = {
  packageName: string;
  title: string;
  text: string;
  timestampMs: number;
};

export type ForegroundAppChangedEvent = {
  packageName: string;
  timestampMs: number;
};

export type OverlayAction = 'keep_going' | 'close_app' | 'snooze';

export type OverlayActionEvent = {
  action: OverlayAction;
  packageName: string;
};

export type AxonNativeModuleEvents = {
  onSmsReceived: (event: SmsReceivedEvent) => void;
  onUpiNotification: (event: UpiNotificationEvent) => void;
  onForegroundAppChanged: (event: ForegroundAppChangedEvent) => void;
  onOverlayAction: (event: OverlayActionEvent) => void;
};
