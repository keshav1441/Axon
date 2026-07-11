import { useEffect } from 'react';

import { insertParsedTransaction } from '@/db/transactions';
import { parseTransactionText } from '@/features/money/parser';
import { subscribeSms, subscribeUpiNotification } from '@/native/axon-native';

/**
 * Mounted once at the app root. Bridges native SMS/notification events into
 * the parser and DB - the raw text passed in from native never touches
 * storage, only the structured fields `parseTransactionText` extracts do.
 */
export function useTransactionCapture() {
  useEffect(() => {
    const unsubscribeSms = subscribeSms(({ body, timestampMs }) => {
      const parsed = parseTransactionText({ source: 'sms', body, timestampMs });
      if (parsed) insertParsedTransaction(parsed);
    });

    const unsubscribeNotification = subscribeUpiNotification(({ text, timestampMs }) => {
      const parsed = parseTransactionText({ source: 'notification', body: text, timestampMs });
      if (parsed) insertParsedTransaction(parsed);
    });

    return () => {
      unsubscribeSms();
      unsubscribeNotification();
    };
  }, []);
}
