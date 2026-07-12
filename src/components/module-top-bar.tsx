import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ModuleHeader } from '@/components/module-header';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ModuleTopBar({
  title,
  accent,
  subtitle,
}: {
  title: string;
  accent: string;
  subtitle?: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <ModuleHeader title={title} accent={accent} subtitle={subtitle} />
      <Pressable onPress={() => router.push('/')} style={styles.homeButton} hitSlop={8}>
        <Ionicons name="home-outline" size={22} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  homeButton: {
    padding: Spacing.two,
  },
});
