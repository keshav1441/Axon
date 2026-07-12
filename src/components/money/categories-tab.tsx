import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listTransactions, summarizeMonth, type TransactionRow } from '@/features/money/api';
import { CATEGORIES } from '@/features/money/categories';
import {
  addCustomCategory,
  getCustomCategories,
  getHiddenDefaultCategories,
  hideDefaultCategory,
  removeCustomCategory,
} from '@/features/money/custom-categories';
import { formatRupees } from '@/features/money/format';

const DEFAULTS = CATEGORIES.filter((c) => c !== 'Uncategorized');

export function CategoriesTab() {
  const theme = useTheme();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [txs, custom, hidden] = await Promise.all([
      listTransactions(),
      getCustomCategories(),
      getHiddenDefaultCategories(),
    ]);
    setTransactions(txs);
    setCustomCategories(custom);
    setHiddenDefaults(hidden);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const rows = useMemo(() => {
    const summary = summarizeMonth(transactions);
    const totals = new Map(summary.byCategory.map((c) => [c.category, c.total]));
    const visibleDefaults = DEFAULTS.filter((c) => !hiddenDefaults.includes(c));
    const names = new Set<string>([...visibleDefaults, ...customCategories]);
    return Array.from(names)
      .map((name) => ({ name, total: totals.get(name) ?? 0, isCustom: customCategories.includes(name) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [transactions, customCategories, hiddenDefaults]);

  const maxTotal = rows[0]?.total || 1;

  const submitNewCategory = useCallback(async () => {
    const name = newCategory.trim();
    if (!name) return;
    setAdding(true);
    try {
      const next = await addCustomCategory(name);
      setCustomCategories(next);
      setNewCategory('');
    } finally {
      setAdding(false);
    }
  }, [newCategory]);

  const removeCategory = useCallback(
    (name: string, isCustom: boolean) => {
      Alert.alert('Remove category', `Remove "${name}"? Existing transactions keep it, but you won't be able to pick it for new ones.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (isCustom) {
              setCustomCategories(await removeCustomCategory(name));
            } else {
              setHiddenDefaults(await hideDefaultCategory(name));
            }
          },
        },
      ]);
    },
    [],
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="heading" style={styles.sectionTitle}>
          This month
        </ThemedText>
        {rows.map((row) => (
          <View key={row.name} style={styles.categoryRow}>
            <View style={styles.categoryMain}>
              <ThemedText type="body">{row.name}</ThemedText>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${row.total ? Math.max((row.total / maxTotal) * 100, 4) : 0}%` },
                  ]}
                />
              </View>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.categoryTotal}>
              {formatRupees(row.total)}
            </ThemedText>
            <Pressable onPress={() => removeCategory(row.name, row.isCustom)} hitSlop={8}>
              <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>
        ))}
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="heading" style={styles.sectionTitle}>
          Add a category
        </ThemedText>
        <View style={styles.addRow}>
          <TextInput
            value={newCategory}
            onChangeText={setNewCategory}
            placeholder="e.g. Rent, Pets, Gifts"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            onSubmitEditing={submitNewCategory}
          />
          <Pressable
            style={[styles.addButton, (!newCategory.trim() || adding) && { opacity: 0.5 }]}
            onPress={submitNewCategory}
            disabled={!newCategory.trim() || adding}>
            <Ionicons name="add" size={20} color="#04120C" />
          </Pressable>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { marginBottom: Spacing.one },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  categoryMain: { flex: 1, gap: Spacing.half },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: ModuleColors.money },
  categoryTotal: { width: 72, textAlign: 'right' },
  addRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    backgroundColor: ModuleColors.money,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
