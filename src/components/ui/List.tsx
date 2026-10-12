import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HapticEngine } from '@/engine/haptics';
import { C, NUM, R, T, alpha } from '@/theme';

import { Icon, IconName } from './Icon';

/** Section groupée façon réglages iOS : titre, carte arrondie, pied de section. */
export function Group({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {title ? <Text style={[T.overline, styles.groupTitle]}>{title}</Text> : null}
      <View style={styles.card}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? <View style={styles.separator} /> : null}
            {child}
          </View>
        ))}
      </View>
      {footer ? <Text style={[T.footnote, styles.groupFooter]}>{footer}</Text> : null}
    </View>
  );
}

/** Ligne de liste : icône teintée optionnelle, libellé, valeur, chevron. */
export function Row({
  label,
  detail,
  value,
  valueColor = C.text2,
  icon,
  iconColor = C.gold,
  onPress,
  chevron,
  right,
  destructive,
}: {
  label: string;
  detail?: string;
  value?: string;
  valueColor?: string;
  icon?: IconName;
  iconColor?: string;
  onPress?: () => void;
  chevron?: boolean;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  const content = (
    <View style={styles.row}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: alpha(iconColor, 0.16) }]}>
          <Icon name={icon} size={18} color={iconColor} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={[T.body, destructive && { color: C.red }]} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text style={[T.footnote, { marginTop: 2 }]} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[T.body, NUM, { color: valueColor, flexShrink: 1, textAlign: 'right' }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {chevron ? <Icon name="chevron-right" size={16} color={C.text3} strokeWidth={2.2} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={() => {
        HapticEngine.ui();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => pressed && { backgroundColor: C.surface3 }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  groupTitle: { paddingHorizontal: 16 },
  groupFooter: { paddingHorizontal: 16, color: C.text3 },
  card: { backgroundColor: C.surface2, borderRadius: R.lg - 4, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 16 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
});
