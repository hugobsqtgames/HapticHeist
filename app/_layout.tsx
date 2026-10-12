import { DarkTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/system/ErrorBoundary';
import { SoundEngine } from '@/engine/audio/SoundEngine';
import { SplashScreen } from '@/screens/SplashScreen';
import { GameProvider, useGame } from '@/state/GameProvider';
import { C } from '@/theme';

const NAV_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, border: C.separator, primary: C.gold, text: C.text },
};

export default function RootLayout() {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(C.bg);
    // Synthèse des sons en tâche de fond, après le premier rendu
    const t = setTimeout(() => void SoundEngine.init(), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={NAV_THEME}>
        <ErrorBoundary>
          <GameProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </GameProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { career } = useGame();
  const [minSplashDone, setMinSplashDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinSplashDone(true), 900);
    return () => clearTimeout(t);
  }, []);

  useAmbience();

  if (!career || !minSplashDone) return <SplashScreen />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="briefing" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="heist" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="success" options={{ gestureEnabled: false }} />
      <Stack.Screen name="busted" options={{ gestureEnabled: false }} />
    </Stack>
  );
}

/** Ambiance sonore de la salle des coffres : plus présente en plein casse, coupée pendant l'arrestation. */
function useAmbience() {
  const { career } = useGame();
  const pathname = usePathname();
  const enabled = !!career?.settings.ambience && !!career?.settings.sound;
  useEffect(() => {
    if (!enabled || pathname === '/busted') SoundEngine.stopLoop('ambience');
    else SoundEngine.startLoop('ambience', pathname === '/heist' ? 0.55 : 0.4);
  }, [enabled, pathname]);
}
