import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { login, signup } from '@/features/auth/api';
import { ApiError } from '@/api/client';

type Mode = 'login' | 'signup';

function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: 'email-address' | 'phone-pad' | 'default';
}) {
  const theme = useTheme();
  const [hidden, setHidden] = useState(!!secure);

  return (
    <View style={styles.fieldWrap}>
      <ThemedText type="micro" themeColor="textSecondary" style={styles.fieldLabel}>
        {label.toUpperCase()}
      </ThemedText>
      <View style={[styles.inputRow, { borderColor: theme.border }]}>
        <Ionicons name={icon} size={18} color={theme.textSecondary} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={secure && hidden}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize="none"
          style={[styles.input, { color: theme.text }]}
        />
        {secure && (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function AuthGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login({ email: email.trim(), password });
      } else {
        await signup({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          confirmPassword,
        });
      }
      onAuthenticated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }, [mode, firstName, lastName, email, phone, password, confirmPassword, onAuthenticated]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.brandBlock}>
              <View style={[styles.badge, { backgroundColor: ModuleColors.home }]}>
                <Ionicons name="flash" size={32} color="#FFFFFF" />
              </View>
              <ThemedText type="title" style={styles.brandName}>
                Axon
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Money, tasks, and focus - synced to your account.
              </ThemedText>
            </View>

            <View style={[styles.modeSwitch, { borderColor: theme.border }]}>
              {(['login', 'signup'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[styles.modeChip, mode === m && { backgroundColor: ModuleColors.home }]}>
                  <ThemedText
                    type="body"
                    style={mode === m ? styles.modeChipTextActive : { color: theme.textSecondary }}>
                    {m === 'login' ? 'Log in' : 'Sign up'}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.form}>
              {mode === 'signup' && (
                <>
                  <View style={styles.nameRow}>
                    <View style={styles.nameField}>
                      <Field label="First name" icon="person-outline" value={firstName} onChangeText={setFirstName} placeholder="Ada" />
                    </View>
                    <View style={styles.nameField}>
                      <Field label="Last name" icon="person-outline" value={lastName} onChangeText={setLastName} placeholder="Lovelace" />
                    </View>
                  </View>
                  <Field
                    label="Phone"
                    icon="call-outline"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="9999999999"
                    keyboardType="phone-pad"
                  />
                </>
              )}
              <Field
                label="Email"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
              />
              <Field label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="••••••••" secure />
              {mode === 'signup' && (
                <Field
                  label="Confirm password"
                  icon="lock-closed-outline"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  secure
                />
              )}
            </View>

            {error && (
              <View style={[styles.errorBox, { borderColor: theme.danger }]}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
                <ThemedText type="small" style={{ color: theme.danger, flex: 1 }}>
                  {error}
                </ThemedText>
              </View>
            )}

            <Pressable
              style={[styles.submitButton, submitting && { opacity: 0.7 }]}
              onPress={submit}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText type="body" style={styles.submitButtonText}>
                  {mode === 'login' ? 'Log in' : 'Create account'}
                </ThemedText>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { padding: Spacing.four, gap: Spacing.four, flexGrow: 1, justifyContent: 'center' },
  brandBlock: { alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  badge: {
    width: 64,
    height: 64,
    borderRadius: Radius.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontWeight: '700' },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.half,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
  modeChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  form: { gap: Spacing.three },
  nameRow: { flexDirection: 'row', gap: Spacing.two },
  nameField: { flex: 1 },
  fieldWrap: { gap: Spacing.one },
  fieldLabel: { marginLeft: Spacing.one },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    borderRadius: Radius.pill,
    backgroundColor: ModuleColors.home,
    minHeight: 52,
  },
  submitButtonText: { fontWeight: '700', color: '#FFFFFF', fontSize: 16 },
});
