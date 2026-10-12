import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, GUTTER, T } from '@/theme';

import { IconButton } from './Button';

/** Conteneur d'écran : fond noir, marges sûres, défilement optionnel, entrée en fondu. */
export function Screen({
  children,
  scroll = true,
  padTop = true,
  padBottom = false,
  footer,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padTop?: boolean;
  padBottom?: boolean;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [fade]);
  const pad = { paddingTop: padTop ? insets.top + 8 : 0, paddingBottom: padBottom ? insets.bottom + 24 : 32 };
  return (
    <View style={styles.root}>
      <Animated.View style={[styles.root, { opacity: fade }]}>
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.content, pad]} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.root, styles.content, pad]}>{children}</View>
        )}
      </Animated.View>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>{footer}</View> : null}
    </View>
  );
}

/** Barre de navigation compacte : retour, titre centré, action à droite. */
export function NavBar({ title, onBack, right, backIcon = 'chevron-left' }: { title?: string; onBack?: () => void; right?: React.ReactNode; backIcon?: 'chevron-left' | 'close' }) {
  return (
    <View style={styles.nav}>
      <View style={styles.navSide}>{onBack ? <IconButton icon={backIcon} label="Retour" onPress={onBack} /> : null}</View>
      <Text style={[T.headline, styles.navTitle]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.navSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

/** Grand titre d'écran avec sous-titre. */
export function LargeTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={T.largeTitle} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={T.subhead}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: GUTTER, gap: 24 },
  footer: { paddingHorizontal: GUTTER, paddingTop: 12, gap: 10, backgroundColor: C.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator },
  nav: { height: 44, flexDirection: 'row', alignItems: 'center' },
  navSide: { width: 72 },
  navTitle: { flex: 1, textAlign: 'center' },
});
