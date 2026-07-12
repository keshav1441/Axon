import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { listTransactions } from '@/features/money/api';

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Data now lives in the cloud DB (HTTPS + your account), not an on-device
 * encrypted file, so export is just a plain CSV snapshot of your own data.
 */
export async function exportTransactionsCsv(): Promise<void> {
  const transactions = await listTransactions();

  const header = ['date', 'direction', 'amount', 'merchant', 'category', 'source'];
  const rows = transactions.map((t) =>
    [
      new Date(t.occurredAt).toISOString(),
      t.direction,
      t.amount,
      t.merchant ?? '',
      t.category ?? '',
      t.source,
    ]
      .map((v) => csvEscape(String(v)))
      .join(','),
  );
  const csv = [header.join(','), ...rows].join('\n');

  const dest = new File(Paths.cache, `axon-transactions-${Date.now()}.csv`);
  dest.create();
  dest.write(csv);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest.uri, { dialogTitle: 'Save Axon transactions' });
  }
}
