import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, BackHandler, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Group, Row } from '@/components/ui/List';
import { Screen } from '@/components/ui/Layout';
import { SoundEngine } from '@/engine/audio/SoundEngine';
import { HapticEngine } from '@/engine/haptics';
import { useGame } from '@/state/GameProvider';
import { C, R, T, alpha } from '@/theme';
import { formatClock, formatMoney } from '@/utils/format';
import { randInt } from '@/utils/math';

/** Halo de gyrophare : une tache de couleur douce qui pulse en haut de l'écran. */
function Beacon({ color, side, value }: { color: string; side: 'left' | 'right'; value: Animated.AnimatedInterpolation<number> | Animated.Value }) {
  const { width } = useWindowDimensions();
  const w = width * 1.1;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -w * 0.45, [side]: -w * 0.35, opacity: value }}>
      <Svg width={w} height={w}>
        <Defs>
          <RadialGradient id={`b-${side}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.55} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={w / 2} rx={w / 2} ry={w / 2} fill={`url(#b-${side})`} />
      </Svg>
    </Animated.View>
  );
}

export function BustedScreen() {
  const { lastResult } = useGame();
  const strobe = useRef(new Animated.Value(0)).current;
  const caseNo = useMemo(() => `${randInt(1000, 9999)}-${String.fromCharCode(65 + randInt(0, 25))}`, []);

  useEffect(() => {
    HapticEngine.alarm(14);
    SoundEngine.startLoop('siren', 0.75);
    const s = Animated.loop(
      Animated.sequence([
        Animated.timing(strobe, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(strobe, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
    );
    s.start();
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      router.dismissAll();
      return true;
    });
    return () => {
      s.stop();
      back.remove();
      SoundEngine.stopLoop('siren');
      HapticEngine.cancelAll();
    };
  }, [strobe]);

  if (!lastResult) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Beacon color={C.red} side="left" value={strobe} />
      <Beacon color={C.blue} side="right" value={strobe.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })} />
      <Screen
        padBottom
        footer={
          <>
            <Button label="Réessayer" onPress={() => router.replace('/heist')} />
            <Button label="S’échapper" variant="secondary" onPress={() => router.dismissAll()} />
          </>
        }
      >
        <View style={styles.head}>
          <View style={styles.badge}>
            <Icon name="siren" size={30} color={C.red} />
          </View>
          <Text style={[T.largeTitle, { color: C.red }]}>Arrêté</Text>
          <Text style={T.subhead}>Dossier de police n° {caseNo}</Text>
        </View>

        <Group title="Rapport">
          <Row label="Lieu" value={lastResult.tierName} />
          <Row label="Niveau" value={`${lastResult.level}`} />
          <Row label="Goupilles crochetées" value={`${lastResult.pinsDone} / ${lastResult.pinsTotal}`} />
          <Row label="Leurres déclenchés" value={`${lastResult.traps}`} />
          <Row label="Temps sur place" value={formatClock(lastResult.timeMs)} />
          <Row label="Motif" value={lastResult.reason === 'time' ? 'Temps écoulé' : 'Alarme silencieuse'} />
          <Row label="Butin perdu" value={formatMoney(lastResult.lootLostEstimate)} valueColor={C.red} />
        </Group>

        <View style={styles.tip}>
          <Icon name="finger" size={22} color={C.gold} />
          <Text style={[T.subhead, { flex: 1, color: C.text }]}>
            Double impulsion feutrée : c’est le vrai point. Un seul choc sec : c’est un leurre, relâchez avant 0,7 s.
          </Text>
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 8, paddingTop: 40 },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: alpha(C.red, 0.16), alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tip: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: R.lg - 4, backgroundColor: alpha(C.gold, 0.1), alignItems: 'flex-start' },
});
