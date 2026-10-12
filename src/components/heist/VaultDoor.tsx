import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';

import { C } from '@/theme';
import { polar } from '@/utils/math';

/** Porte de coffre à plat : huit pênes radiaux et un volant à six branches. */
export function VaultDoor({ size, wheelRot, boltAnim }: { size: number; wheelRot: Animated.AnimatedInterpolation<string>; boltAnim: Animated.Value }) {
  const c = size / 2;
  const bolts = Array.from({ length: 8 }, (_, i) => i * 45 + 22.5);
  const boltLen = size * 0.12;
  return (
    <View style={{ width: size, height: size }}>
      {bolts.map((a) => (
        <Animated.View
          key={a}
          style={[
            styles.bolt,
            {
              left: c - size * 0.024,
              top: c - boltLen / 2,
              width: size * 0.048,
              height: boltLen,
              transform: [{ rotate: `${a}deg` }, { translateY: boltAnim.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.52, -size * 0.4] }) }],
            },
          ]}
        />
      ))}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={size * 0.47} fill={C.surface2} />
        <Circle cx={c} cy={c} r={size * 0.36} fill="none" stroke={C.surface3} strokeWidth={2} />
        {Array.from({ length: 24 }).map((_, i) => {
          const p = polar(c, c, size * 0.42, i * 15);
          return <Circle key={i} cx={p.x} cy={p.y} r={size * 0.007} fill={C.surface4} />;
        })}
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: wheelRot }] }]}>
        <Svg width={size} height={size}>
          {Array.from({ length: 6 }).map((_, i) => {
            const p = polar(c, c, size * 0.24, i * 60);
            return (
              <G key={i}>
                <Line x1={c} y1={c} x2={p.x} y2={p.y} stroke={C.text3} strokeWidth={size * 0.022} strokeLinecap="round" />
                <Circle cx={p.x} cy={p.y} r={size * 0.028} fill={C.text2} />
              </G>
            );
          })}
          <Circle cx={c} cy={c} r={size * 0.07} fill={C.surface4} />
          <Circle cx={c} cy={c} r={size * 0.025} fill={C.gold} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bolt: { position: 'absolute', borderRadius: 6, backgroundColor: C.surface4 },
});
