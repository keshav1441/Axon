import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthGate } from '@/components/auth-gate';
import { isLoggedIn, subscribeAuthChange } from '@/features/auth/api';
import { useFocusSessionTracking } from '@/features/focus/use-focus-session-tracking';
import { useTransactionCapture } from '@/features/money/use-transaction-capture';
import { ThemePreferenceProvider, useThemePreference } from '@/hooks/use-theme-preference';

SplashScreen.preventAutoHideAsync();

function AuthedApp() {
  useTransactionCapture();
  useFocusSessionTracking();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="money" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="focus" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

function RootContent() {
  const { resolvedScheme } = useThemePreference();
  const [authed, setAuthed] = useState<boolean | null>(null);

  const checkAuth = useCallback(() => {
    isLoggedIn().then(setAuthed);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAuth();
    });
    return () => sub.remove();
  }, [checkAuth]);

  useEffect(() => subscribeAuthChange(checkAuth), [checkAuth]);

  return (
    <ThemeProvider value={resolvedScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {authed === true ? (
        <AuthedApp />
      ) : authed === false ? (
        <AuthGate onAuthenticated={() => setAuthed(true)} />
      ) : null}
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <ThemePreferenceProvider>
      <RootContent />
    </ThemePreferenceProvider>
  );
}
