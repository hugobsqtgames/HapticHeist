import { useFocusEffect } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LootBadge } from '@/components/loot/LootIcon';
import { FilterPill } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { LargeTitle } from '@/components/ui/Layout';
import { HapticEngine } from '@/engine/haptics';
import { useCareer, useGame } from '@/state/GameProvider';
import { C, GUTTER, NUM, R, RARITY_META, RARITY_ORDER, T } from '@/theme';
import type { LootItem, Rarity } from '@/types/game';
import { formatClock, formatDate, formatMoney, formatMoneyShort } from '@/utils/format';

const LootRow = memo(function LootRow({ item, highlight }: { item: LootItem; highlight: boolean }) {
  const [open, setOpen] = useState(false);
  const rar = RARITY_META[item.rarity];
  const glow = useRef(new Animated.Value(highlight ? 1 : 0)).current;
  useEffect(() => {
    if (highlight) Animated.timing(glow, { toValue: 0, duration: 2600, useNativeDriver: false }).start();
  }, [highlight, glow]);
  return (
    <Pressable
      onPress={() => {
        HapticEngine.ui();
        setOpen((o) => !o);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatMoney(item.value)}`}
    >
      <Animated.View style={[styles.row, { backgroundColor: glow.interpolate({ inputRange: [0, 1], outputRange: [C.surface2, C.surface4] }) }]}>
        <LootBadge kind={item.kind} hue={item.hue} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={T.headline} numberOfLines={open ? 3 : 1}>
            {item.name}
          </Text>
          <Text style={T.footnote} numberOfLines={1}>
            <Text style={{ color: rar.color }}>{rar.label}</Text>
            {item.blind ? ' · Aveugle' : ''} · Niv. {item.level}
          </Text>
          {open ? (
            <Text style={[T.footnote, { marginTop: 4 }]}>
              {item.location}
              {'\n'}
              {formatDate(item.date)}
            </Text>
          ) : null}
        </View>
        <Text style={[T.headline, NUM, { color: C.gold }]}>{formatMoneyShort(item.value)}</Text>
      </Animated.View>
    </Pressable>
  );
});

export function VaultScreen() {
  const career = useCareer();
  const { highlightId, setHighlightId } = useGame();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all' | Rarity>('all');
  const [sort, setSort] = useState<'date' | 'value'>('date');

  // La mise en évidence ne vaut que pour la visite qui suit un casse
  useFocusEffect(useCallback(() => () => setHighlightId(null), [setHighlightId]));

  const items = useMemo(() => {
    const list = filter === 'all' ? career.loot : career.loot.filter((l) => l.rarity === filter);
    return [...list].sort((a, b) => (sort === 'date' ? b.date - a.date : b.value - a.value));
  }, [career.loot, filter, sort]);
  const top = useMemo(() => career.loot.reduce<LootItem | null>((m, l) => (!m || l.value > m.value ? l : m), null), [career.loot]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: C.bg }}
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: insets.top + 8, paddingBottom: 32, gap: 8 }}
      initialNumToRender={12}
      windowSize={7}
      ListHeaderComponent={
        <View style={{ gap: 20, marginBottom: 12 }}>
          <LargeTitle title="Butin" subtitle={`${career.loot.length} objet${career.loot.length > 1 ? 's' : ''} · ${career.heists} casse${career.heists > 1 ? 's' : ''}`} />
          <View style={styles.total}>
            <Text style={T.footnote}>Valeur totale</Text>
            <Text style={[styles.totalValue, NUM]} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(career.totalLoot)}
            </Text>
            <View style={styles.totalMeta}>
              <Text style={T.footnote}>Record {career.bestTimeMs ? formatClock(career.bestTimeMs) : '—'}</Text>
              {top ? (
                <Text style={[T.footnote, { flexShrink: 1, textAlign: 'right' }]} numberOfLines={1}>
                  Pièce maîtresse : {top.name}
                </Text>
              ) : null}
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <FilterPill label="Tout" selected={filter === 'all'} onPress={() => setFilter('all')} />
            {RARITY_ORDER.map((r) => (
              <FilterPill key={r} label={RARITY_META[r].label} selected={filter === r} onPress={() => setFilter(r)} />
            ))}
            <FilterPill label={sort === 'date' ? 'Plus récents' : 'Plus chers'} selected={false} onPress={() => setSort((s) => (s === 'date' ? 'value' : 'date'))} />
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="vault" size={32} color={C.text3} />
          </View>
          <Text style={T.headline}>{career.loot.length === 0 ? 'Aucun butin pour l’instant' : 'Rien dans cette catégorie'}</Text>
          <Text style={[T.subhead, { textAlign: 'center' }]}>Chaque coffre ouvert dépose ici son trésor, stocké uniquement sur cet appareil.</Text>
        </View>
      }
      renderItem={({ item }) => <LootRow item={item} highlight={item.id === highlightId} />}
    />
  );
}

const styles = StyleSheet.create({
  total: { backgroundColor: C.surface2, borderRadius: R.xl, padding: 20, gap: 4 },
  totalValue: { color: C.gold, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5 },
  totalMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.lg - 4 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
});
