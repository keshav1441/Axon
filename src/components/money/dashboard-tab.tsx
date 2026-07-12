import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import {
  detectSubscriptions,
  flushPendingTransactions,
  listTransactions,
  summarizeMonth,
  type MonthSummary,
  type SubscriptionGuess,
  type TransactionRow,
} from '@/features/money/api';
import { formatRupees } from '@/features/money/format';
import { usePermissionStatus } from '@/native/axon-native';

const SYNC_INTERVAL_MS = Number(process.env.EXPO_PUBLIC_MONEY_SYNC_INTERVAL_SECONDS ?? '30') * 1000;

function PermissionRow({ label, kind }: { label: string; kind: 'sms' | 'notificationAccess' }) {
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

const BAR_COLORS = ['#34D399', '#5EEAD4', '#93C5FD', '#C4B5FD', '#FDA4AF'];

function CategoryBarChart({ byCategory }: { byCategory: MonthSummary['byCategory'] }) {
  const top = byCategory.slice(0, 5);
  const max = top[0]?.total ?? 1;

  return (
    <View style={styles.chart}>
      {top.map((c, i) => (
        <View key={c.category} style={styles.chartRow}>
          <ThemedText type="small" style={styles.chartLabel} numberOfLines={1}>
            {c.category}
          </ThemedText>
          <View style={styles.chartTrack}>
            <View
              style={[
                styles.chartFill,
                { width: `${Math.max((c.total / max) * 100, 4)}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] },
              ]}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.chartValue}>
            {formatRupees(c.total)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

export function DashboardTab({ onSeeAllTransactions }: { onSeeAllTransactions?: () => void }) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionGuess[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const txs = await listTransactions();
    setTransactions(txs);
    setSummary(summarizeMonth(txs));
    setSubscriptions(detectSubscriptions(txs));
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await flushPendingTransactions();
      await load();
    } finally {
      setSyncing(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      sync();
      const interval = setInterval(sync, SYNC_INTERVAL_MS);
      return () => clearInterval(interval);
    }, [sync]),
  );

  const recent = useMemo(() => transactions.slice(0, 5), [transactions]);
  const net = (summary?.totalIncome ?? 0) - (summary?.totalSpend ?? 0);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerRow}>
        <ThemedText type="micro" themeColor="textSecondary">
          Parsed from SMS
        </ThemedText>
        <Pressable style={styles.syncButton} onPress={sync} disabled={syncing}>
          {syncing ? (
            <ActivityIndicator size="small" color={ModuleColors.money} />
          ) : (
            <ThemedText type="small" style={{ color: ModuleColors.money }}>
              Sync now
            </ThemedText>
          )}
        </Pressable>
      </View>

      <PermissionRow label="SMS access" kind="sms" />

      <ThemedView type="backgroundElement" style={styles.heroCard}>
        <ThemedText type="micro" themeColor="textSecondary">
          NET THIS MONTH
        </ThemedText>
        <ThemedText type="display" style={[styles.heroValue, { color: net >= 0 ? ModuleColors.money : '#EF4444' }]}>
          {net >= 0 ? '+' : '-'}
          {formatRupees(Math.abs(net))}
        </ThemedText>

        <View style={styles.heroDivider} />

        <View style={styles.heroSplitRow}>
          <View style={styles.heroSplitCol}>
            <View style={styles.heroSplitLabel}>
              <Ionicons name="arrow-up-circle-outline" size={16} color="#EF4444" />
              <ThemedText type="micro" themeColor="textSecondary">
                DEBITED
              </ThemedText>
            </View>
            <ThemedText type="heading">{formatRupees(summary?.totalSpend ?? 0)}</ThemedText>
          </View>
          <View style={styles.heroSplitDivider} />
          <View style={[styles.heroSplitCol, styles.heroSplitColRight]}>
            <View style={styles.heroSplitLabel}>
              <ThemedText type="micro" themeColor="textSecondary">
                CREDITED
              </ThemedText>
              <Ionicons name="arrow-down-circle-outline" size={16} color={ModuleColors.money} />
            </View>
            <ThemedText type="heading" style={{ color: ModuleColors.money }}>
              {formatRupees(summary?.totalIncome ?? 0)}
            </ThemedText>
          </View>
        </View>
      </ThemedView>

      {summary && summary.byCategory.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="heading" style={styles.sectionTitle}>
            Spend by category
          </ThemedText>
          <CategoryBarChart byCategory={summary.byCategory} />
        </ThemedView>
      )}

      {subscriptions.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="heading" style={styles.sectionTitle}>
            Recurring charges
          </ThemedText>
          {subscriptions.map((s) => (
            <View key={`${s.merchant}-${s.amount}`} style={styles.rowBetween}>
              <ThemedText type="small">{s.merchant}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatRupees(s.amount)} · next ~{new Date(s.estimatedNextDate).toLocaleDateString()}
              </ThemedText>
            </View>
          ))}
        </ThemedView>
      )}

      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.rowBetween}>
          <ThemedText type="heading">Recent</ThemedText>
          {onSeeAllTransactions && (
            <Pressable onPress={onSeeAllTransactions}>
              <ThemedText type="small" style={{ color: ModuleColors.money }}>
                See all →
              </ThemedText>
            </Pressable>
          )}
        </View>
        {recent.length === 0 ? (
          <ThemedText type="body" themeColor="textSecondary">
            No transactions parsed yet.
          </ThemedText>
        ) : (
          recent.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={styles.txMain}>
                <ThemedText type="body" numberOfLines={1}>
                  {tx.merchant ?? 'Unknown'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {tx.category ?? 'Uncategorized'} · {new Date(tx.occurredAt).toLocaleDateString()}
                </ThemedText>
              </View>
              <ThemedText type="body" style={{ color: tx.direction === 'credit' ? ModuleColors.money : undefined }}>
                {tx.direction === 'credit' ? '+' : '-'}
                {formatRupees(Number(tx.amount))}
              </ThemedText>
            </View>
          ))
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  heroCard: { borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.two },
  heroValue: { fontSize: 44, lineHeight: 48 },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: Spacing.one },
  heroSplitRow: { flexDirection: 'row', alignItems: 'center' },
  heroSplitCol: { flex: 1, gap: Spacing.half },
  heroSplitColRight: { alignItems: 'flex-end' },
  heroSplitLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half },
  heroSplitDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: Spacing.three },
  sectionTitle: { marginBottom: Spacing.one },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    minWidth: 84,
    alignItems: 'center',
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chart: { gap: Spacing.two },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chartLabel: { width: 84 },
  chartTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  chartFill: { height: '100%', borderRadius: 5 },
  chartValue: { width: 64, textAlign: 'right' },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  txMain: { flex: 1, gap: Spacing.half, paddingRight: Spacing.two },
});
