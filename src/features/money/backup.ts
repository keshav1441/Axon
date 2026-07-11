import { ANDROID_DATABASE_PATH } from '@op-engineering/op-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getOrCreateDbKey } from '@/db/key';

/**
 * The DB file on disk is already SQLCipher-encrypted (AES-256), so "export"
 * just shares that file plus the recovery key needed to reopen it - no
 * separate, weaker export format is invented for this.
 */
export async function exportEncryptedBackup(): Promise<{ recoveryKey: string }> {
  const recoveryKey = await getOrCreateDbKey();
  const dbFile = new File(`file://${ANDROID_DATABASE_PATH}/axon.db`);
  const dest = new File(Paths.cache, `axon-backup-${Date.now()}.db`);

  await dbFile.copy(dest);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest.uri, {
      dialogTitle: 'Save Axon backup (keep the recovery key with it)',
    });
  }

  return { recoveryKey };
}
