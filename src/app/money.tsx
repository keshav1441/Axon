import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { BankingTab } from '@/components/money/banking-tab';
import { CategoriesTab } from '@/components/money/categories-tab';
import { DashboardTab } from '@/components/money/dashboard-tab';
import { TransactionsTab } from '@/components/money/transactions-tab';
import { ModuleTopBar } from '@/components/module-top-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MoneyTab = 'dashboard' | 'banking' | 'categories' | 'transactions';

const TABS: { key: MoneyTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'bar-chart-outline' },
  { key: 'banking', label: 'Banking', icon: 'business-outline' },
  { key: 'categories', label: 'Categories', icon: 'pricetags-outline' },
  { key: 'transactions', label: 'Transactions', icon: 'list-outline' },
];

export default function MoneyScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState<MoneyTab>('dashboard');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ModuleTopBar title="Expenses" accent={ModuleColors.money} />

        <View style={styles.content}>
          {tab === 'dashboard' && <DashboardTab onSeeAllTransactions={() => setTab('transactions')} />}
          {tab === 'banking' && <BankingTab />}
          {tab === 'categories' && <CategoriesTab />}
          {tab === 'transactions' && <TransactionsTab />}
        </View>

        <View style={[styles.bottomBar, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[
                  styles.bottomBarItem,
                  { borderColor: theme.border },
                  active && styles.bottomBarItemActive,
                ]}>
                <Ionicons name={t.icon} size={24} color={active ? ModuleColors.money : theme.textSecondary} />
                <ThemedText
                  type="small"
                  style={active ? { color: ModuleColors.money, fontWeight: '600' } : { color: theme.textSecondary }}>
                  {t.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flex: 1 },
  bottomBar: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  bottomBarItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bottomBarItemActive: {
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderColor: 'rgba(52,211,153,0.35)',
  },
});
