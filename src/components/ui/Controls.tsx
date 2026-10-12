import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { HapticEngine } from '@/engine/haptics';
import { C, alpha } from '@/theme';

/** Interrupteur au gabarit iOS (51 × 31). */
export function Toggle({ value, onChange, label, tint = C.green }: { value: boolean; onChange: (v: boolean) => void; label: string; tint?: string }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: value ? 1 : 0, friction: 8, tension: 140, useNativeDriver: false }).start();
  }, [value, anim]);
  return (
    <Pressable
      onPress={() => {
        HapticEngine.ui();
        onChange(!value);
      }}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
    >
      <Animated.View style={[styles.track, { backgroundColor: anim.interpolate({ inputRange: [0, 1], outputRange: [C.surface4, tint] }) }]}>
        <Animated.View style={[styles.knob, { transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] }) }] }]} />
      </Animated.View>
    </Pressable>
  );
}

/** Contrôle segmenté avec pastille glissante. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: idx, friction: 9, tension: 120, useNativeDriver: true }).start();
  }, [idx, x]);
  const segW = w > 0 ? (w - 4) / options.length : 0;
  return (
    <View style={styles.segment} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {segW > 0 ? (
        <Animated.View
          style={[
            styles.segmentPill,
            { width: segW, transform: [{ translateX: x.interpolate({ inputRange: [0, Math.max(1, options.length - 1)], outputRange: [0, segW * Math.max(1, options.length - 1)] }) }] },
          ]}
        />
      ) : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            style={styles.segmentItem}
            onPress={() => {
              if (on) return;
              HapticEngine.ui();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.segmentText, on && { color: C.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pastille teintée (métadonnées, rareté, statut). */
export function Chip({ label, color = C.text2, solid }: { label: string; color?: string; solid?: boolean }) {
  return (
    <View style={[styles.chip, { backgroundColor: solid ? color : alpha(color, 0.16) }]}>
      <Text style={[styles.chipText, { color: solid ? C.black : color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Puce de filtre sélectionnable. */
export function FilterPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        HapticEngine.ui();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.filter, selected && { backgroundColor: C.text }]}
    >
      <Text style={[styles.filterText, selected && { color: C.black }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 51, height: 31, borderRadius: 16, justifyContent: 'center' },
  knob: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#FFFFFF' },
  segment: { flexDirection: 'row', backgroundColor: C.surface3, borderRadius: 9, padding: 2, height: 34 },
  segmentPill: { position: 'absolute', top: 2, left: 2, bottom: 2, borderRadius: 7, backgroundColor: C.surface4 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: C.text2, fontSize: 13, fontWeight: '600' },
  chip: { height: 26, borderRadius: 13, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  chipText: { fontSize: 13, fontWeight: '600' },
  filter: { height: 34, borderRadius: 17, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface2 },
  filterText: { color: C.text, fontSize: 14, fontWeight: '600' },
});
