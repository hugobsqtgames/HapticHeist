import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { Icon, IconName } from '@/components/ui/Icon';
import { HapticEngine } from '@/engine/haptics';
import { C } from '@/theme';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Accueil', icon: 'home' },
  { name: 'vault', title: 'Butin', icon: 'vault' },
  { name: 'tutorial', title: 'Tutoriel', icon: 'finger' },
  { name: 'settings', title: 'Réglages', icon: 'settings' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.gold,
        tabBarInactiveTintColor: C.text3,
        tabBarStyle: { backgroundColor: 'rgba(10,10,11,0.98)', borderTopColor: C.separator, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        sceneStyle: { backgroundColor: C.bg },
      }}
      screenListeners={{ tabPress: () => HapticEngine.ui() }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{ title: t.title, tabBarIcon: ({ color }) => <Icon name={t.icon} size={25} color={color as string} strokeWidth={1.9} /> }}
        />
      ))}
    </Tabs>
  );
}
