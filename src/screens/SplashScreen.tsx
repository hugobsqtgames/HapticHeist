import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/brand/Logo';
import { C, T } from '@/theme';

/** Écran affiché pendant le chargement local de la carrière et la synthèse audio. */
export function SplashScreen() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v]);
  return (
    <View style={styles.root}>
      <Animated.View style={{ alignItems: 'center', gap: 16, opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
        <AppIcon size={96} />
        <Animated.Text style={[T.headline, { color: C.text2 }]}>Haptic Heist</Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
});
