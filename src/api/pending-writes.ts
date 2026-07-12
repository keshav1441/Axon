import * as SecureStore from 'expo-secure-store';

const QUEUE_KEY = 'axon_pending_writes';

type PendingWrite = { path: string; body: unknown; timestamp: number };

async function readQueue(): Promise<PendingWrite[]> {
  const raw = await SecureStore.getItemAsync(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingWrite[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingWrite[]): Promise<void> {
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * SMS/UPI notifications can arrive with no data connectivity, so a failed
 * transaction POST can't just be dropped - it's queued here and retried on
 * the next flush instead. Not a general local DB: nothing is ever read from
 * this queue except to retry delivery.
 */
export async function enqueuePendingWrite(path: string, body: unknown): Promise<void> {
  const queue = await readQueue();
  queue.push({ path, body, timestamp: Date.now() });
  await writeQueue(queue);
}

export async function flushPendingWrites(post: (path: string, body: unknown) => Promise<unknown>): Promise<void> {
  const queue = await readQueue();
  if (queue.length === 0) return;

  const remaining: PendingWrite[] = [];
  for (const item of queue) {
    try {
      await post(item.path, item.body);
    } catch {
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
}
