import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Icon } from '@/components/ui/Icon';
import { LockEngine } from '@/engine/lock/LockEngine';
import { PulseBus } from '@/engine/pulseBus';
import { useBlink } from '@/hooks/useBlink';
import { C, NUM, R, T } from '@/theme';
import { formatClock } from '@/utils/format';
import { clamp } from '@/utils/math';

/** Goupilles : une capsule par goupille, pleine quand elle est débloquée. */
export function PinRow({ total, done, errorKey, accent }: { total: number; done: number; errorKey: number; accent: string }) {
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const pulse = useBlink(900, true, 0.35);
  useEffect(() => {
    if (errorKey === 0) return;
    flash.setValue(1);
    Animated.parallel([
      Animated.sequence([8, -8, 6, -6, 3, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 45, useNativeDriver: true }))),
      Animated.timing(flash, { toValue: 0, duration: 900, useNativeDriver: false }),
    ]).start();
  }, [errorKey, shake, flash]);
  return (
    <Animated.View style={[styles.pins, { transform: [{ translateX: shake }] }]} accessibilityLabel={`${done} goupille(s) sur ${total} débloquée(s)`}>
      {Array.from({ length: total }).map((_, i) => {
        const isDone = i < done;
        const isActive = i === done;
        const bg = isDone ? accent : flash.interpolate({ inputRange: [0, 1], outputRange: [isActive ? C.surface4 : C.surface2, C.red] });
        return <Animated.View key={i} style={[styles.pin, { backgroundColor: bg, opacity: isActive ? pulse : 1 }]} />;
      })}
    </Animated.View>
  );
}

/** Essais restants : des points qui s'éteignent. */
export function LivesDots({ lives, max }: { lives: number; max: number }) {
  const blink = useBlink(500, lives === 1, 0.2);
  const color = lives === 1 ? C.red : C.text;
  return (
    <Animated.View style={[styles.lives, { opacity: lives === 1 ? blink : 1 }]} accessibilityLabel={`${lives} essai(s) restant(s) sur ${max}`}>
      <Icon name="shield" size={14} color={color} strokeWidth={2.2} />
      <Text style={[styles.livesText, NUM, { color }]}>
        {lives}/{max}
      </Text>
    </Animated.View>
  );
}

export interface HeistClockStatus {
  leftMs: number;
  limitMs: number;
  lives: number;
  maxLives: number;
}

/** Chrono + jauge de stress, auto-rafraîchis à 10 i/s sans re-rendre l'écran. */
export function TimerBar({ getStatus, accent }: { getStatus: () => HeistClockStatus; accent: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => (x + 1) % 1e6), 100);
    return () => clearInterval(t);
  }, []);
  const s = getStatus();
  const timeRatio = s.limitMs > 0 ? 1 - s.leftMs / s.limitMs : 0;
  const lifeRatio = 1 - s.lives / s.maxLives;
  const stress = clamp(s.limitMs > 0 ? timeRatio * 0.65 + lifeRatio * 0.45 : lifeRatio * 0.9, 0, 1);
  const critical = stress > 0.7 || (s.limitMs > 0 && s.leftMs < 10000);
  const blink = useBlink(450, critical, 0.35);
  const barColor = critical ? C.red : stress > 0.45 ? C.gold : accent;
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      {s.limitMs > 0 ? (
        <Animated.Text style={[styles.clock, NUM, { color: critical ? C.red : C.text, opacity: critical ? blink : 1 }]} accessibilityLabel="Temps restant">
          {formatClock(s.leftMs).replace(/^0/, '')}
        </Animated.Text>
      ) : (
        <Text style={[T.title3, { color: C.text2, height: 50, lineHeight: 50 }]}>Sans limite de temps</Text>
      )}
      <View style={styles.stressTrack} accessibilityLabel={`Stress ${Math.round(stress * 100)} %`}>
        <View style={[styles.stressFill, { width: `${Math.max(2, stress * 100)}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

/** Onde haptique (accent) et audio (gris) en temps réel. */
export function Waveform({ width, height = 40, blind }: { width: number; height?: number; blind: boolean }) {
  const N = 56;
  const hap = useRef(new Array<number>(N).fill(0)).current;
  const aud = useRef(new Array<number>(N).fill(0)).current;
  const phase = useRef(0);
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      PulseBus.haptic *= 0.8;
      PulseBus.audio *= 0.78;
      hap.shift();
      aud.shift();
      hap.push(PulseBus.haptic);
      aud.push(PulseBus.audio);
      phase.current += 0.55;
      force((x) => (x + 1) % 1e6);
    }, 40);
    return () => clearInterval(t);
  }, [hap, aud]);
  const mid = height / 2;
  const toPath = (arr: number[], freq: number, amp: number) => {
    let d = '';
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * width;
      const e = blind ? 0 : arr[i];
      const y = mid + Math.sin(i * freq + phase.current) * e * amp * mid;
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${clamp(y, 1, height - 1).toFixed(1)} `;
    }
    return d;
  };
  return (
    <Svg width={width} height={height} accessibilityElementsHidden>
      <Path d={toPath(aud, 1.7, 0.6)} stroke={C.text3} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Path d={toPath(hap, 0.9, 0.95)} stroke={C.gold} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** Lecture numérique de l'angle (et de l'écart à la cible en mode triche). */
export function AngleReadout({ engine, blind, cheat }: { engine: LockEngine; blind: boolean; cheat: boolean }) {
  const [reading, setReading] = useState(0);
  const [delta, setDelta] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => {
      setReading(Math.round(engine.reading) % 360);
      setDelta(engine.nearestDist < 999 ? engine.nearestDist : null);
    }, 66);
    return () => clearInterval(t);
  }, [engine]);
  return (
    <View style={{ alignItems: 'flex-end', minWidth: 76 }}>
      <Text style={[styles.angle, NUM]}>{blind ? '—' : `${reading}°`}</Text>
      {cheat && delta != null ? (
        <Text style={[T.caption, NUM, { color: engine.nearestKind === 'decoy' ? C.red : C.green }]}>
          {engine.nearestKind === 'decoy' ? 'Leurre' : 'Cible'} à {delta.toFixed(1)}°
        </Text>
      ) : (
        <Text style={T.caption}>Angle</Text>
      )}
    </View>
  );
}

/** Simulateur visuel : liseré d'écran à chaque vibration (émulateurs, tablettes). */
export function SimulatorFlash({ enabled }: { enabled: boolean }) {
  const op = useRef(new Animated.Value(0)).current;
  const [color, setColor] = useState<string>(C.gold);
  useEffect(() => {
    if (!enabled) return;
    return PulseBus.subscribe((kind, energy, channel) => {
      if (channel !== 'haptic') return;
      setColor(kind === 'anchor' ? C.green : kind === 'decoy' || kind === 'error' || kind === 'alarm' ? C.red : C.gold);
      op.setValue(clamp(energy, 0.15, 1));
      Animated.timing(op, { toValue: 0, duration: kind === 'tick' ? 120 : 380, useNativeDriver: true }).start();
    });
  }, [enabled, op]);
  if (!enabled) return null;
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 3, borderColor: color, borderRadius: 40, opacity: op }]} />;
}

const styles = StyleSheet.create({
  pins: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  pin: { width: 28, height: 6, borderRadius: 3 },
  lives: { flexDirection: 'row', gap: 4, alignItems: 'center', height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: C.surface2 },
  livesText: { fontSize: 13, fontWeight: '600' },
  clock: { fontSize: 44, lineHeight: 50, fontWeight: '700', letterSpacing: -1 },
  stressTrack: { width: 160, height: 4, borderRadius: R.pill, backgroundColor: C.surface2, overflow: 'hidden' },
  stressFill: { height: 4, borderRadius: R.pill },
  angle: { color: C.text, fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -0.5 },
});
