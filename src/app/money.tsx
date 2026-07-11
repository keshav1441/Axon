import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModuleHeader } from '@/components/module-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import {
  detectSubscriptions,
  getMonthSummary,
  listTransactions,
  updateTransactionCategory,
  type MonthSummary,
  type SubscriptionGuess,
  type TransactionRow,
} from '@/db/transactions';
import { CATEGORIES, type Category } from '@/features/money/categories';
import { exportEncryptedBackup } from '@/features/money/backup';
import { usePermissionStatus } from '@/native/axon-native';
import { useFocusEffect } from 'expo-router';

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
  return { start, end };
}

function PermissionRow({
  label,
  kind,
}: {
  label: string;
  kind: 'sms' | 'notificationAccess';
}) {
  const { granted, request } = usePermissionStatus(kind);
  if (granted) return null;
  return (
    <Pressable onPress={request} style={styles.permissionRow}>
      <ThemedText type="small">{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Grant →
      </ThemedText>
    </Pressable>
  );
}

function CategoryPicker({
  transactionId,
  onPicked,
}: {
  transactionId: string;
  onPicked: () => void;
}) {
  return (
    <View style={styles.categoryChipRow}>
      {CATEGORIES.map((category) => (
        <Pressable
          key={category}
          style={styles.categoryChip}
          onPress={async () => {
            await updateTransactionCategory(transactionId, category);
            onPicked();
          }}>
          <ThemedText type="micro">{category}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function TransactionRowView({ tx }: { tx: TransactionRow }) {
  const [editing, setEditing] = useState(false);
  const [, forceRefresh] = useState(0);
  const isCredit = tx.direction === 'credit';

  return (
    <View>
      <Pressable onPress={() => setEditing((v) => !v)} style={styles.txRow}>
        <View style={styles.txMain}>
          <ThemedText type="body">{tx.merchant ?? 'Unknown'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {tx.category ?? 'Uncategorized'} · {new Date(tx.occurred_at).toLocaleDateString()}
          </ThemedText>
        </View>
        <ThemedText
          type="body"
          themeColor={isCredit ? 'text' : 'text'}
          style={{ color: isCredit ? ModuleColors.money : undefined }}>
          {isCredit ? '+' : '-'}
          {formatRupees(tx.amount)}
        </ThemedText>
      </Pressable>
      {editing && (
        <CategoryPicker transactionId={tx.id} onPicked={() => forceRefresh((n) => n + 1)} />
      )}
    </View>
  );
}

export default function MoneyScreen() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionGuess[]>([]);

  const load = useCallback(async () => {
    const { start, end } = monthBounds();
    const [txs, monthSummary] = await Promise.all([listTransactions(200), getMonthSummary(start, end)]);
    setTransactions(txs);
    setSummary(monthSummary);
    setSubscriptions(detectSubscriptions(txs));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const topCategories = useMemo(() => summary?.byCategory.slice(0, 5) ?? [], [summary]);

  const onExport = useCallback(async () => {
    try {
      const { recoveryKey } = await exportEncryptedBackup();
      Alert.alert(
        'Backup exported',
        `Keep this recovery key somewhere safe - you need it to restore the backup:\n\n${recoveryKey}`,
      );
    } catch (err) {
      Alert.alert('Export failed', String(err));
    }
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ModuleHeader
            title="Money"
            accent={ModuleColors.money}
            subtitle="Parsed from SMS + UPI notifications"
          />

          <ThemedView type="backgroundElement" style={styles.card}>
            <PermissionRow label="SMS access" kind="sms" />
            <PermissionRow label="Notification access (UPI apps)" kind="notificationAccess" />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="micro" themeColor="textSecondary">
              THIS MONTH
            </ThemedText>
            <ThemedText type="display">{formatRupees(summary?.totalSpend ?? 0)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              spent · {formatRupees(summary?.totalIncome ?? 0)} in
            </ThemedText>
          </ThemedView>

          {topCategories.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="heading" style={styles.sectionTitle}>
                By category
              </ThemedText>
              {topCategories.map((c) => (
                <View key={c.category} style={styles.categoryRow}>
                  <ThemedText type="small">{c.category}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatRupees(c.total)}
                  </ThemedText>
                </View>
              ))}
            </ThemedView>
          )}

          {subscriptions.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="heading" style={styles.sectionTitle}>
                Recurring charges
              </ThemedText>
              {subscriptions.map((s) => (
                <View key={`${s.merchant}-${s.amount}`} style={styles.categoryRow}>
                  <ThemedText type="small">{s.merchant}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatRupees(s.amount)} · next ~{new Date(s.estimatedNextDate).toLocaleDateString()}
                  </ThemedText>
                </View>
              ))}
            </ThemedView>
          )}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="heading" style={styles.sectionTitle}>
              Transactions
            </ThemedText>
            {transactions.length === 0 ? (
              <ThemedText type="body" themeColor="textSecondary">
                No transactions parsed yet.
              </ThemedText>
            ) : (
              transactions.map((tx) => <TransactionRowView key={tx.id} tx={tx} />)
            )}
          </ThemedView>

          <Pressable style={styles.exportButton} onPress={onExport}>
            <ThemedText type="body" style={styles.exportButtonText}>
              Export encrypted backup
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { marginBottom: Spacing.one },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  txMain: { gap: Spacing.half },
  categoryChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingBottom: Spacing.two,
  },
  categoryChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  exportButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: Spacing.two,
  },
  exportButtonText: {
    fontWeight: '600',
  },
});
