import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { VaultDoor } from '@/components/heist/VaultDoor';
import { LootIcon } from '@/components/loot/LootIcon';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { SoundEngine } from '@/engine/audio/SoundEngine';
import { HapticEngine } from '@/engine/haptics';
import { tierForLevel } from '@/game/content';
import { useGame } from '@/state/GameProvider';
import { C, GUTTER, NUM, R, RARITY_META, T } from '@/theme';
import { formatClock, formatMoney } from '@/utils/format';

export function SuccessScreen() {
  const { lastResult, setHeistLevel, setHighlightId } = useGame();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const loot = lastResult?.loot;
  const doorSize = Math.min(width * 0.72, height * 0.38, 340);

  const wheel = useRef(new Animated.Value(0)).current;
  const bolts = useRef(new Animated.Value(0)).current;
  const swing = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const banner = useRef(new Animated.Value(0)).current;
  const counter = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!loot) return;
    HapticEngine.vaultOpen();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    [0, 180, 360, 540].forEach((ms) => at(ms, () => SoundEngine.play('bolt', 0.95)));
    at(900, () => SoundEngine.play('alarmOff', 0.8));
    at(1500, () => SoundEngine.play('hiss', 0.8));
    at(2350, () => {
      SoundEngine.play('reveal', 0.85);
      SoundEngine.play('coins', 0.9);
      HapticEngine.notify(Haptics.NotificationFeedbackType.Success);
    });
    Animated.sequence([
      Animated.parallel([
        Animated.timing(wheel, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bolts, { toValue: 1, duration: 800, delay: 100, easing: Easing.in(Easing.back(1.4)), useNativeDriver: true }),
        Animated.sequence([Animated.delay(800), Animated.timing(banner, { toValue: 1, duration: 300, useNativeDriver: true })]),
      ]),
      Animated.delay(200),
      Animated.timing(swing, { toValue: 1, duration: 850, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(card, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
    const id = counter.addListener(({ value }) => setShown(value));
    at(2400, () => Animated.timing(counter, { toValue: loot.value, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start());
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      router.dismissAll();
      return true;
    });
    return () => {
      timers.forEach(clearTimeout);
      counter.removeListener(id);
      back.remove();
    };
  }, [loot, wheel, bolts, swing, card, banner, counter]);

  if (!lastResult || !loot) return <View style={styles.root} />;
  const rar = RARITY_META[loot.rarity];
  const next = tierForLevel(lastResult.level + 1);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <Animated.View style={[styles.banner, { opacity: banner }]}>
        <View style={styles.dot} />
        <Text style={[T.footnote, { color: C.text }]}>Alarme désactivée</Text>
      </Animated.View>

      <View style={[styles.stage, { height: doorSize + 24 }]}>
        <View style={{ width: doorSize, height: doorSize, alignItems: 'center', justifyContent: 'center' }}>
          {/* Intérieur du coffre */}
          <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', opacity: swing }]}>
            <Svg width={doorSize} height={doorSize} style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={rar.color} stopOpacity={0.35} />
                  <Stop offset="1" stopColor={rar.color} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={doorSize / 2} cy={doorSize / 2} r={doorSize / 2} fill="url(#glow)" />
            </Svg>
            <LootIcon kind={loot.kind} hue={loot.hue} size={doorSize * 0.44} />
          </Animated.View>
          {/* Porte qui pivote sur ses gonds */}
          <Animated.View
            style={{
              position: 'absolute',
              transformOrigin: 'left',
              transform: [{ perspective: 900 }, { rotateY: swing.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-110deg'] }) }],
              opacity: swing.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            }}
          >
            <VaultDoor size={doorSize} wheelRot={wheel.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] })} boltAnim={bolts} />
          </Animated.View>
        </View>
      </View>

      <Animated.View
        style={[
          styles.content,
          { opacity: card, transform: [{ translateY: card.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
        ]}
      >
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Chip label={rar.label} color={rar.color} />
          <Text style={[T.title1, { textAlign: 'center' }]}>{loot.name}</Text>
          <Text style={[styles.value, NUM]}>{formatMoney(Math.round(shown))}</Text>
          <Text style={[T.footnote, { textAlign: 'center' }]}>
            {lastResult.tierName} · {formatClock(lastResult.timeMs)} · {lastResult.traps} leurre{lastResult.traps > 1 ? 's' : ''}
            {loot.blind ? ' · aveugle × 1,5' : ''}
          </Text>
        </View>
        <View style={{ gap: 10, alignSelf: 'stretch' }}>
          <Button
            label="Emporter le butin"
            icon="vault"
            onPress={() => {
              SoundEngine.play('coins', 1);
              setHighlightId(loot.id);
              router.dismissTo('/vault');
            }}
          />
          <Button
            label={`Casse suivant · ${next.name}`}
            variant="secondary"
            onPress={() => {
              setHeistLevel(lastResult.level + 1);
              router.replace('/briefing');
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  banner: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, height: 32, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: C.surface2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  stage: { alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  content: { flex: 1, justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingTop: 8, gap: 20 },
  value: { color: C.gold, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5 },
});
