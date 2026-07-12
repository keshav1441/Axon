import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addBankAccount,
  addManualTransaction,
  listBankAccounts,
  listTransactions,
  updateTransactionCategory,
  type BankAccount,
  type TransactionRow,
} from '@/features/money/api';
import { CATEGORIES } from '@/features/money/categories';
import { getCustomCategories, getHiddenDefaultCategories } from '@/features/money/custom-categories';
import { formatRupees } from '@/features/money/format';
import { readCache, writeCache } from '@/lib/cache';

const TRANSACTIONS_CACHE_KEY = 'money-transactions';
const ACCOUNTS_CACHE_KEY = 'money-accounts';

const ASSIGNABLE_DEFAULTS: string[] = CATEGORIES.filter((c) => c !== 'Uncategorized');

function isUncategorized(tx: TransactionRow): boolean {
  return !tx.category || tx.category === 'Uncategorized';
}

function TriageModal({
  queue,
  categories,
  onDone,
}: {
  queue: TransactionRow[];
  categories: string[];
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const current = queue[index];

  const pick = useCallback(
    async (category: string) => {
      await updateTransactionCategory(current.id, category);
      if (index + 1 < queue.length) {
        setIndex(index + 1);
      } else {
        onDone();
      }
    },
    [current, index, queue.length, onDone],
  );

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onDone}>
      <View style={styles.modalBackdrop}>
        <ThemedView type="backgroundElement" style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <ThemedText type="small" themeColor="textSecondary">
              {index + 1} of {queue.length}
            </ThemedText>
            <Pressable onPress={onDone} hitSlop={8}>
              <Ionicons name="close" size={22} color={ModuleColors.money} />
            </Pressable>
          </View>

          <ThemedText type="heading" numberOfLines={1}>
            {current.merchant ?? 'Unknown merchant'}
          </ThemedText>
          <ThemedText type="display" style={{ color: current.direction === 'credit' ? ModuleColors.money : undefined }}>
            {current.direction === 'credit' ? '+' : '-'}
            {formatRupees(Number(current.amount))}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.modalDate}>
            {new Date(current.occurredAt).toLocaleDateString()}
          </ThemedText>

          <ThemedText type="micro" themeColor="textSecondary" style={styles.modalPrompt}>
            PICK A CATEGORY
          </ThemedText>
          <View style={styles.categoryGrid}>
            {categories.map((category) => (
              <Pressable key={category} style={styles.categoryChip} onPress={() => pick(category)}>
                <ThemedText type="small">{category}</ThemedText>
              </Pressable>
            ))}
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

function EditCategoryModal({
  tx,
  categories,
  onSaved,
  onClose,
}: {
  tx: TransactionRow;
  categories: string[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(tx.category ?? '');
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateTransactionCategory(tx.id, selected);
      onSaved();
    } finally {
      setSaving(false);
    }
  }, [tx.id, selected, onSaved]);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ThemedView type="backgroundElement" style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <ThemedText type="heading" numberOfLines={1} style={styles.modalTitle}>
              {tx.merchant ?? 'Unknown merchant'}
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={ModuleColors.money} />
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.modalDate}>
            {formatRupees(Number(tx.amount))} · {new Date(tx.occurredAt).toLocaleDateString()}
          </ThemedText>

          <ThemedText type="micro" themeColor="textSecondary" style={styles.modalPrompt}>
            PICK A CATEGORY
          </ThemedText>
          <View style={styles.categoryGrid}>
            {categories.map((category) => (
              <Pressable
                key={category}
                style={[styles.categoryChip, selected === category && styles.categoryChipSelected]}
                onPress={() => setSelected(category)}>
                <ThemedText type="small" style={selected === category ? { color: ModuleColors.money } : undefined}>
                  {category}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.addButton, (!selected || saving) && { opacity: 0.5 }]}
            onPress={save}
            disabled={!selected || saving}>
            <ThemedText type="body" style={styles.addButtonText}>
              {saving ? 'Saving…' : 'Save'}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const SOURCE_META: Record<TransactionRow['source'], { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  sms: { icon: 'chatbox-ellipses-outline', label: 'SMS' },
  notif: { icon: 'notifications-outline', label: 'Notification' },
  manual: { icon: 'create-outline', label: 'Manual' },
};

function Chip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={12} color={theme.textSecondary} />
      <ThemedText type="micro" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

function TransactionRowView({
  tx,
  accountLabel,
  onPress,
}: {
  tx: TransactionRow;
  accountLabel: string | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const isCredit = tx.direction === 'credit';
  const source = SOURCE_META[tx.source];

  return (
    <Pressable onPress={onPress} style={[styles.txCard, { borderColor: theme.border }]}>
      <View style={styles.txIconWrap}>
        <Ionicons
          name={isCredit ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
          size={24}
          color={isCredit ? ModuleColors.money : theme.textSecondary}
        />
      </View>
      <View style={styles.txBody}>
        <View style={styles.txHeaderRow}>
          <ThemedText type="body" numberOfLines={1} style={styles.txMerchant}>
            {tx.merchant ?? 'Unknown merchant'}
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.txAmount, { color: isCredit ? ModuleColors.money : theme.text }]}>
            {isCredit ? '+' : '-'}
            {formatRupees(Number(tx.amount))}
          </ThemedText>
        </View>
        <View style={styles.chipRow}>
          <Chip icon="pricetag-outline" label={tx.category ?? 'Uncategorized'} />
          {accountLabel && <Chip icon="business-outline" label={accountLabel} />}
          <Chip icon="calendar-outline" label={new Date(tx.occurredAt).toLocaleDateString()} />
          <Chip icon={source.icon} label={source.label} />
        </View>
      </View>
    </Pressable>
  );
}

function AddTransactionForm({
  accounts,
  onAdded,
  onBankAdded,
}: {
  accounts: BankAccount[];
  onAdded: () => void;
  onBankAdded: () => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [addingBank, setAddingBank] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newLastDigits, setNewLastDigits] = useState('');
  const [newCardType, setNewCardType] = useState<'debit' | 'credit'>('debit');
  const [savingBank, setSavingBank] = useState(false);

  const submitBank = useCallback(async () => {
    if (!newBankName.trim() || newLastDigits.trim().length < 4) {
      Alert.alert('Missing info', 'Enter a bank name and the last 4 digits.');
      return;
    }
    setSavingBank(true);
    try {
      const acc = await addBankAccount({
        bankName: newBankName.trim(),
        lastDigits: newLastDigits.trim().slice(-4),
        cardType: newCardType,
      });
      setBankAccountId(acc.id);
      setAddingBank(false);
      setNewBankName('');
      setNewLastDigits('');
      onBankAdded();
    } catch (err) {
      Alert.alert('Could not add bank', String(err));
    } finally {
      setSavingBank(false);
    }
  }, [newBankName, newLastDigits, newCardType, onBankAdded]);

  const submit = useCallback(async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Enter an amount greater than 0.');
      return;
    }
    if (!bankAccountId) {
      Alert.alert('Bank required', 'Select or add a bank account for this transaction.');
      return;
    }
    setSubmitting(true);
    try {
      await addManualTransaction({ amount: parsed, direction, merchant: merchant.trim() || undefined, bankAccountId });
      setAmount('');
      setMerchant('');
      setBankAccountId(null);
      setOpen(false);
      onAdded();
    } catch (err) {
      Alert.alert('Could not add', String(err));
    } finally {
      setSubmitting(false);
    }
  }, [amount, direction, merchant, bankAccountId, onAdded]);

  if (!open) {
    return (
      <Pressable style={styles.addToggle} onPress={() => setOpen(true)}>
        <Ionicons name="add-circle-outline" size={18} color={ModuleColors.money} />
        <ThemedText type="body" style={{ color: ModuleColors.money }}>
          Add transaction
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={styles.addForm}>
      <View style={styles.typeRow}>
        {(['credit', 'debit'] as const).map((type) => (
          <Pressable
            key={type}
            onPress={() => setDirection(type)}
            style={[styles.typeChip, direction === type && styles.typeChipActive]}>
            <ThemedText type="small" style={direction === type ? { color: ModuleColors.money } : undefined}>
              {type === 'credit' ? 'Money in' : 'Money out'}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="Amount"
        placeholderTextColor={theme.textSecondary}
        keyboardType="numeric"
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />
      <TextInput
        value={merchant}
        onChangeText={setMerchant}
        placeholder="Note (optional)"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />

      <ThemedText type="micro" themeColor="textSecondary">
        BANK ACCOUNT
      </ThemedText>
      <View style={styles.bankChipRow}>
        {accounts.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => setBankAccountId(a.id)}
            style={[styles.bankChip, { borderColor: theme.border }, bankAccountId === a.id && styles.bankChipActive]}>
            <ThemedText type="small" style={bankAccountId === a.id ? { color: ModuleColors.money } : undefined}>
              {a.label || `${a.bankName} ••${a.lastDigits}`}
            </ThemedText>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setAddingBank((v) => !v)}
          style={[styles.bankChip, { borderColor: theme.border }, addingBank && styles.bankChipActive]}>
          <Ionicons name="add" size={14} color={addingBank ? ModuleColors.money : theme.textSecondary} />
          <ThemedText type="small" style={addingBank ? { color: ModuleColors.money } : undefined}>
            New bank
          </ThemedText>
        </Pressable>
      </View>

      {accounts.length === 0 && !addingBank && (
        <ThemedText type="small" themeColor="textSecondary">
          No bank linked yet — add one to attach this transaction.
        </ThemedText>
      )}

      {addingBank && (
        <View style={styles.inlineBankForm}>
          <TextInput
            value={newBankName}
            onChangeText={setNewBankName}
            placeholder="Bank name"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <TextInput
            value={newLastDigits}
            onChangeText={setNewLastDigits}
            placeholder="Last 4 digits"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            maxLength={4}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <View style={styles.typeRow}>
            {(['debit', 'credit'] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => setNewCardType(type)}
                style={[styles.typeChip, newCardType === type && styles.typeChipActive]}>
                <ThemedText type="small" style={newCardType === type ? { color: ModuleColors.money } : undefined}>
                  {type === 'debit' ? 'Debit card' : 'Credit card'}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <Pressable style={[styles.addButton, savingBank && { opacity: 0.6 }]} onPress={submitBank} disabled={savingBank}>
            <ThemedText type="body" style={styles.addButtonText}>
              {savingBank ? 'Saving…' : 'Save bank'}
            </ThemedText>
          </Pressable>
        </View>
      )}

      <Pressable
        style={[styles.addButton, (submitting || !bankAccountId) && { opacity: 0.5 }]}
        onPress={submit}
        disabled={submitting || !bankAccountId}>
        <ThemedText type="body" style={styles.addButtonText}>
          {submitting ? 'Adding…' : 'Add'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

export function TransactionsTab() {
  const theme = useTheme();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>([]);
  const [triageQueue, setTriageQueue] = useState<TransactionRow[] | null>(null);
  const [editingTx, setEditingTx] = useState<TransactionRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const categories = useMemo(() => {
    const defaults = ASSIGNABLE_DEFAULTS.filter((c) => !hiddenDefaults.includes(c));
    return [...defaults, ...customCategories.filter((c) => !defaults.includes(c))];
  }, [customCategories, hiddenDefaults]);

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts) map.set(a.id, a.label || `${a.bankName} ••${a.lastDigits}`);
    return map;
  }, [accounts]);

  const load = useCallback(async () => {
    const [txs, accs, custom, hidden] = await Promise.all([
      listTransactions(),
      listBankAccounts(),
      getCustomCategories(),
      getHiddenDefaultCategories(),
    ]);
    setTransactions(txs);
    setAccounts(accs);
    setCustomCategories(custom);
    setHiddenDefaults(hidden);
    writeCache(TRANSACTIONS_CACHE_KEY, txs);
    writeCache(ACCOUNTS_CACHE_KEY, accs);
    return txs;
  }, []);

  useEffect(() => {
    readCache<TransactionRow[]>(TRANSACTIONS_CACHE_KEY).then((cached) => {
      if (cached) setTransactions(cached);
    });
    readCache<BankAccount[]>(ACCOUNTS_CACHE_KEY).then((cached) => {
      if (cached) setAccounts(cached);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().then((txs) => {
        const uncategorized = txs.filter(isUncategorized);
        if (uncategorized.length > 0) {
          Alert.alert(
            `${uncategorized.length} uncategorized ${uncategorized.length === 1 ? 'expense' : 'expenses'}`,
            'Want to categorize them now?',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Start', onPress: () => setTriageQueue(uncategorized) },
            ],
          );
        }
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ModuleColors.money} />}>

        <ThemedView type="backgroundElement" style={styles.card}>
          <AddTransactionForm accounts={accounts} onAdded={load} onBankAdded={load} />
        </ThemedView>

        {transactions.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="body" themeColor="textSecondary">
              No transactions yet.
            </ThemedText>
          </ThemedView>
        ) : (
          transactions.map((tx) => (
            <TransactionRowView
              key={tx.id}
              tx={tx}
              accountLabel={tx.bankAccountId ? accountLabelById.get(tx.bankAccountId) ?? null : null}
              onPress={() => setEditingTx(tx)}
            />
          ))
        )}
      </ScrollView>

      {editingTx && (
        <EditCategoryModal
          tx={editingTx}
          categories={categories}
          onSaved={() => {
            setEditingTx(null);
            load();
          }}
          onClose={() => setEditingTx(null)}
        />
      )}

      {triageQueue && triageQueue.length > 0 && (
        <TriageModal
          queue={triageQueue}
          categories={categories}
          onDone={() => {
            setTriageQueue(null);
            load();
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  txCard: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  txIconWrap: { paddingTop: Spacing.half },
  txBody: { flex: 1, gap: Spacing.two },
  txHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  txMerchant: { flex: 1 },
  txAmount: { fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  addToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, justifyContent: 'center', paddingVertical: Spacing.one },
  addForm: { gap: Spacing.two },
  typeRow: { flexDirection: 'row', gap: Spacing.two },
  typeChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  typeChipActive: { backgroundColor: 'rgba(52,211,153,0.18)' },
  bankChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  bankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bankChipActive: { backgroundColor: 'rgba(52,211,153,0.18)', borderColor: ModuleColors.money },
  inlineBankForm: { gap: Spacing.two, marginTop: Spacing.one },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  addButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: ModuleColors.money,
  },
  addButtonText: { fontWeight: '600', color: '#04120C' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  modalTitle: { flex: 1 },
  modalDate: { marginBottom: Spacing.two },
  modalPrompt: { marginTop: Spacing.two },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  categoryChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  categoryChipSelected: {
    backgroundColor: 'rgba(52,211,153,0.18)',
    borderColor: ModuleColors.money,
  },
});
