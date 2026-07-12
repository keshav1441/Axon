import { useEffect, useRef } from 'react';

import { flushPendingTransactions, submitParsedTransaction } from '@/features/money/api';
import { parseTransactionText } from '@/features/money/parser';
import { getRecentSms, subscribeSms } from '@/native/axon-native';

const SYNC_INTERVAL_MS =
  Number(process.env.EXPO_PUBLIC_MONEY_SYNC_INTERVAL_SECONDS ?? '30') * 1000;

// Overlap each poll window slightly so a message landing right at the
// boundary between two polls never gets missed. Safe to double-submit -
// the backend is idempotent on dedupRef.
const POLL_OVERLAP_MS = 5000;

/**
 * Mounted once at the app root. Bridges native SMS events into the parser
 * and the backend - the raw text passed in from native never touches
 * storage or the network, only the structured fields `parseTransactionText`
 * extracts do. SMS-only by design: UPI notifications are not used as an
 * expense source.
 */
export function useTransactionCapture() {
  const lastPolledAtRef = useRef(Date.now());

  useEffect(() => {
    flushPendingTransactions();
    const interval = setInterval(flushPendingTransactions, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Polling fallback: reads the SMS inbox directly every sync interval, so
  // capture doesn't depend on the real-time broadcast listener having a live
  // JS bridge to deliver into (misses happen when the app is backgrounded).
  useEffect(() => {
    const pollSms = async () => {
      const since = lastPolledAtRef.current - POLL_OVERLAP_MS;
      lastPolledAtRef.current = Date.now();
      try {
        const messages = await getRecentSms(since);
        for (const { body, timestampMs } of messages) {
          const parsed = parseTransactionText({ source: 'sms', body, timestampMs });
          if (parsed) await submitParsedTransaction(parsed);
        }
      } catch {
        // SMS permission not granted yet, or the native call failed - just retry next cycle.
      }
    };
    pollSms();
    const interval = setInterval(pollSms, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribeSms = subscribeSms(({ body, timestampMs }) => {
      const parsed = parseTransactionText({ source: 'sms', body, timestampMs });
      if (parsed) submitParsedTransaction(parsed);
    });

    return unsubscribeSms;
  }, []);
}
