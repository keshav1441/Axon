import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ColorValue, useColorScheme } from 'react-native';

import { Colors, ModuleColors } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  name,
  color,
  size = 22,
}: {
  name: IconName;
  color: ColorValue;
  size?: number;
}) {
  return <Ionicons name={name} color={color as string} size={size} />;
}

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' || !scheme ? 'dark' : scheme];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarInactiveTintColor: colors.textSecondary,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarActiveTintColor: ModuleColors.home,
          tabBarIcon: ({ color, size }) => <TabIcon name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: 'Money',
          tabBarActiveTintColor: ModuleColors.money,
          tabBarIcon: ({ color, size }) => <TabIcon name="wallet" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarActiveTintColor: ModuleColors.tasks,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="checkmark-circle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="focus"
        options={{
          title: 'Focus',
          tabBarActiveTintColor: ModuleColors.focus,
          tabBarIcon: ({ color, size }) => <TabIcon name="timer" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
