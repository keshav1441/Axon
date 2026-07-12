import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { login, signup } from '@/features/auth/api';
import { ApiError } from '@/api/client';

type Mode = 'login' | 'signup';

function Field({
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: 'email-address' | 'phone-pad' | 'default';
}) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.textSecondary}
      secureTextEntry={secure}
      keyboardType={keyboardType ?? 'default'}
      autoCapitalize="none"
      style={[styles.input, { color: theme.text, borderColor: theme.border }]}
    />
  );
}

export function AuthGate({ onAuthenticated }: { onAuthenticated: () => void }) {
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
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="display">{mode === 'login' ? 'Log in' : 'Create account'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Axon syncs your data to your account.
          </ThemedText>

          <View style={styles.form}>
            {mode === 'signup' && (
              <>
                <Field value={firstName} onChangeText={setFirstName} placeholder="First name" />
                <Field value={lastName} onChangeText={setLastName} placeholder="Last name" />
                <Field value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
              </>
            )}
            <Field value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" />
            <Field value={password} onChangeText={setPassword} placeholder="Password" secure />
            {mode === 'signup' && (
              <Field
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                secure
              />
            )}
          </View>

          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}

          <Pressable style={styles.submitButton} onPress={submit} disabled={submitting}>
            <ThemedText type="body" style={styles.submitButtonText}>
              {submitting ? '…' : mode === 'login' ? 'Log in' : 'Sign up'}
            </ThemedText>
          </Pressable>

          <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} style={styles.switchModeButton}>
            <ThemedText type="small" themeColor="textSecondary">
              {mode === 'login' ? "No account? Sign up" : 'Have an account? Log in'}
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
  form: { gap: Spacing.two, marginTop: Spacing.two },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  error: { color: '#EF4444' },
  submitButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: ModuleColors.home,
    marginTop: Spacing.two,
  },
  submitButtonText: { fontWeight: '600', color: '#FFFFFF' },
  switchModeButton: { alignItems: 'center', paddingVertical: Spacing.two },
});
