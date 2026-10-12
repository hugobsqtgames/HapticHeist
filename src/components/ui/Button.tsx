import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { SoundEngine } from '@/engine/audio/SoundEngine';
import { HapticEngine } from '@/engine/haptics';
import { C, R, alpha } from '@/theme';

import { Icon, IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'tinted' | 'danger' | 'ghost';

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string }> = {
  primary: { bg: C.gold, fg: C.onGold },
  secondary: { bg: C.surface2, fg: C.text },
  tinted: { bg: C.goldSoft, fg: C.gold },
  danger: { bg: C.red, fg: '#FFFFFF' },
  ghost: { bg: 'transparent', fg: C.gold },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  disabled,
  loading,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const v = VARIANTS[variant];
  const h = size === 'lg' ? 56 : size === 'md' ? 46 : 36;
  const fontSize = size === 'lg' ? 17 : size === 'md' ? 16 : 14;
  return (
    <Animated.View style={[{ transform: [{ scale }], opacity: disabled ? 0.4 : 1 }, style]}>
      <Pressable
        disabled={disabled || loading}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start()}
        onPress={() => {
          HapticEngine.ui();
          SoundEngine.play('ui', 0.5);
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [
          styles.base,
          { height: h, borderRadius: size === 'sm' ? R.sm : R.md, backgroundColor: v.bg },
          variant === 'ghost' && pressed && { backgroundColor: alpha(C.gold, 0.08) },
          pressed && variant !== 'ghost' && { opacity: 0.88 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : (
          <View style={styles.row}>
            {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={v.fg} strokeWidth={2} /> : null}
            <Text style={[styles.label, { color: v.fg, fontSize }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Bouton rond à icône seule (barres de navigation, pause). */
export function IconButton({ icon, onPress, label, tint = C.text }: { icon: IconName; onPress: () => void; label: string; tint?: string }) {
  return (
    <Pressable
      onPress={() => {
        HapticEngine.ui();
        onPress();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: C.surface3 }]}
    >
      <Icon name={icon} size={20} color={tint} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontWeight: '600', letterSpacing: -0.2 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
});
