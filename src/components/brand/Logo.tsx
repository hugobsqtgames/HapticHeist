import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { C, T } from '@/theme';
import { mulberry32, polar } from '@/utils/math';

/** Arcs d'empreinte digitale procéduraux (ellipses concentriques interrompues). */
function fingerprintPaths(cx: number, cy: number, rings: number, step: number): string[] {
  const out: string[] = [];
  const rnd = mulberry32(2024);
  for (let i = 0; i < rings; i++) {
    const rx = 3 + i * step;
    const ry = 4.2 + i * step * 1.14;
    const segs = i < 2 ? 1 : 2;
    const gapStart = rnd() * 360;
    const span = 360 / segs;
    for (let s = 0; s < segs; s++) {
      if (i >= rings - 1 && s === segs - 1) continue;
      const from = gapStart + s * span + 14 + rnd() * 10;
      const to = gapStart + (s + 1) * span - 14 - rnd() * 10;
      let d = '';
      for (let a = from; a <= to; a += 6) {
        const rad = (a * Math.PI) / 180;
        const x = cx + rx * Math.sin(rad);
        const y = cy - ry * Math.cos(rad) + i * 0.3;
        d += `${d ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
      }
      if (d) out.push(d);
    }
  }
  return out;
}

/**
 * Le logo Haptic Heist : un cadran gradué dont le centre est une empreinte digitale.
 * Entièrement à plat : un trait, une couleur d'accent, aucun reflet.
 */
export const LogoMark = memo(function LogoMark({ size, ringRotation }: { size: number; ringRotation?: Animated.AnimatedInterpolation<string> }) {
  const prints = useMemo(() => fingerprintPaths(60, 61, 6, 5.4), []);
  const ticks = useMemo(() => {
    let minor = '';
    let major = '';
    for (let i = 0; i < 48; i++) {
      const a = i * 7.5;
      const isMajor = i % 4 === 0;
      const p1 = polar(60, 60, isMajor ? 49 : 51, a);
      const p2 = polar(60, 60, 55, a);
      const seg = `M${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L${p2.x.toFixed(2)} ${p2.y.toFixed(2)} `;
      if (isMajor) major += seg;
      else minor += seg;
    }
    return { minor, major };
  }, []);
  const ring = (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Path d={ticks.minor} stroke={C.text3} strokeWidth={1.6} strokeLinecap="round" />
      <Path d={ticks.major} stroke={C.text2} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
  return (
    <View style={{ width: size, height: size }}>
      {ringRotation ? <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: ringRotation }] }]}>{ring}</Animated.View> : <View style={StyleSheet.absoluteFill}>{ring}</View>}
      <Svg width={size} height={size} viewBox="0 0 120 120" style={StyleSheet.absoluteFill}>
        <Circle cx={60} cy={60} r={43} fill={C.surface2} />
        {prints.map((d, i) => (
          <Path key={i} d={d} stroke={C.gold} strokeWidth={2.8} fill="none" strokeLinecap="round" />
        ))}
        <Path d="M60 2.5 L64 9 H56 Z" fill={C.gold} />
      </Svg>
    </View>
  );
});

/** Icône d'application : la marque sur un carré arrondi noir. */
export function AppIcon({ size = 64 }: { size?: number }) {
  return (
    <View style={[styles.icon, { width: size, height: size, borderRadius: size * 0.225 }]}>
      <LogoMark size={size * 0.82} />
    </View>
  );
}

/** Logo animé de l'accueil : entrée en ressort, cadran qui « cherche », ondes haptiques. */
export function AnimatedLogo({ size = 112 }: { size?: number }) {
  const intro = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const waves = useRef([0, 1].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.spring(intro, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }).start();
    const s = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: -1, duration: 1800, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(300),
        Animated.timing(sway, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(300),
        Animated.timing(sway, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    const w = waves.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 1300),
          Animated.timing(v, { toValue: 1, duration: 2600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    s.start();
    w.forEach((x) => x.start());
    return () => {
      s.stop();
      w.forEach((x) => x.stop());
    };
  }, [intro, sway, waves]);

  const ringRotation = sway.interpolate({ inputRange: [-1, 1], outputRange: ['-40deg', '40deg'] });

  return (
    <View style={{ alignItems: 'center', gap: 20 }}>
      <View style={{ width: size * 1.5, height: size * 1.5, alignItems: 'center', justifyContent: 'center' }}>
        {waves.map((v, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 1,
              borderColor: C.gold,
              opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.35, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
            }}
          />
        ))}
        <Animated.View style={{ opacity: intro, transform: [{ scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
          <LogoMark size={size} ringRotation={ringRotation} />
        </Animated.View>
      </View>
      <Animated.View
        style={{
          alignItems: 'center',
          gap: 4,
          opacity: intro,
          transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }}
      >
        <Text style={[T.largeTitle, { letterSpacing: -0.5 }]}>Haptic Heist</Text>
        <Text style={T.subhead}>Le crochetage au bout des doigts</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.surface3 },
});
