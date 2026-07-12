import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addBankAccount,
  listBankAccounts,
  listTransactions,
  removeBankAccount,
  setBankAccountLimit,
  spendByAccount,
  type BankAccount,
} from '@/features/money/api';
import { formatRupees } from '@/features/money/format';

function AddBankForm({ onAdded }: { onAdded: () => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [bankName, setBankName] = useState('');
  const [lastDigits, setLastDigits] = useState('');
  const [cardType, setCardType] = useState<'debit' | 'credit'>('debit');
  const [adding, setAdding] = useState(false);

  const submit = useCallback(async () => {
    if (!bankName.trim() || lastDigits.trim().length < 2) {
      Alert.alert('Missing info', 'Enter a bank name and at least the last 2 digits of the account/card.');
      return;
    }
    setAdding(true);
    try {
      await addBankAccount({ bankName: bankName.trim(), lastDigits: lastDigits.trim(), cardType });
      setBankName('');
      setLastDigits('');
      setOpen(false);
      onAdded();
    } catch (err) {
      Alert.alert('Could not add bank', String(err));
    } finally {
      setAdding(false);
    }
  }, [bankName, lastDigits, cardType, onAdded]);

  if (!open) {
    return (
      <Pressable style={styles.addToggle} onPress={() => setOpen(true)}>
        <Ionicons name="add-circle-outline" size={18} color={ModuleColors.money} />
        <ThemedText type="body" style={{ color: ModuleColors.money }}>
          Add a bank or card
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={styles.addForm}>
      <TextInput
        value={bankName}
        onChangeText={setBankName}
        placeholder="Bank name (e.g. ICICI, HDFC)"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />
      <TextInput
        value={lastDigits}
        onChangeText={setLastDigits}
        placeholder="Last 3-4 digits"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        maxLength={6}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />
      <View style={styles.typeRow}>
        {(['debit', 'credit'] as const).map((type) => (
          <Pressable
            key={type}
            onPress={() => setCardType(type)}
            style={[styles.typeChip, cardType === type && styles.typeChipActive]}>
            <ThemedText type="small" style={cardType === type ? { color: ModuleColors.money } : undefined}>
              {type === 'debit' ? 'Debit' : 'Credit'}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <Pressable style={[styles.addButton, adding && { opacity: 0.6 }]} onPress={submit} disabled={adding}>
        <ThemedText type="body" style={styles.addButtonText}>
          {adding ? 'Adding…' : 'Add'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function AccountCard({
  account,
  spent,
  onChanged,
}: {
  account: BankAccount;
  spent: number;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitText, setLimitText] = useState(account.limitAmount ?? '');
  const limit = account.limitAmount ? Number(account.limitAmount) : null;
  const ratio = limit ? Math.min(spent / limit, 1) : 0;
  const overLimit = limit != null && spent > limit;

  const commitLimit = useCallback(async () => {
    setEditingLimit(false);
    const parsed = Number(limitText);
    await setBankAccountLimit(account.id, Number.isFinite(parsed) && parsed > 0 ? parsed : null);
    onChanged();
  }, [account.id, limitText, onChanged]);

  return (
    <View style={[styles.accountCard, { borderColor: theme.border }]}>
      <View style={styles.accountHeader}>
        <View style={styles.accountIcon}>
          <Ionicons
            name={account.cardType === 'credit' ? 'card-outline' : 'business-outline'}
            size={18}
            color={ModuleColors.money}
          />
        </View>
        <View style={styles.accountMain}>
          <ThemedText type="body">{account.label || account.bankName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {account.bankName} · •••• {account.lastDigits} · {account.cardType}
          </ThemedText>
        </View>
        <Pressable
          onPress={async () => {
            await removeBankAccount(account.id);
            onChanged();
          }}
          hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${(limit ? ratio : 0) * 100}%`, backgroundColor: overLimit ? '#EF4444' : ModuleColors.money },
          ]}
        />
      </View>
      <View style={styles.limitFooter}>
        <ThemedText type="small" themeColor="textSecondary">
          {formatRupees(spent)} spent this month
        </ThemedText>
        {editingLimit ? (
          <TextInput
            value={limitText}
            onChangeText={setLimitText}
            onBlur={commitLimit}
            autoFocus
            keyboardType="numeric"
            placeholder="No limit"
            placeholderTextColor={theme.textSecondary}
            style={[styles.limitInput, { color: theme.text }]}
          />
        ) : (
          <Pressable onPress={() => setEditingLimit(true)}>
            <ThemedText type="small" style={{ color: ModuleColors.money }}>
              {limit != null ? `limit ${formatRupees(limit)}` : 'set limit'}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function BankingTab() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [spent, setSpent] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const [accs, txs] = await Promise.all([listBankAccounts(), listTransactions()]);
    setAccounts(accs);
    setSpent(spendByAccount(txs));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {accounts.length === 0 ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="body" themeColor="textSecondary">
            No banks or cards added yet. Add one below — transactions with a matching last-4-digits + bank name
            auto-tag to it.
          </ThemedText>
        </ThemedView>
      ) : (
        accounts.map((a) => (
          <AccountCard key={a.id} account={a} spent={spent[a.id] ?? 0} onChanged={load} />
        ))
      )}

      <ThemedView type="backgroundElement" style={styles.card}>
        <AddBankForm onAdded={load} />
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  accountCard: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  accountHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  accountIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(52,211,153,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountMain: { flex: 1, gap: Spacing.half },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  limitFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  limitInput: { minWidth: 80, textAlign: 'right', fontSize: 14 },
  addToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, justifyContent: 'center', paddingVertical: Spacing.one },
  addForm: { gap: Spacing.two },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.two },
  typeChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  typeChipActive: { backgroundColor: 'rgba(52,211,153,0.18)' },
  addButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: ModuleColors.money,
  },
  addButtonText: { fontWeight: '600', color: '#04120C' },
});
