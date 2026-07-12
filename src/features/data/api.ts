import { apiPost } from '@/api/client';

export type ClearDataScope = 'money' | 'tasks' | 'focus' | 'all';

export async function clearData(scope: ClearDataScope): Promise<void> {
  await apiPost('/api/data/clear', { scope });
}
