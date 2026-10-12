import React, { memo, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { DETENT_DEG, LockEngine } from '@/engine/lock/LockEngine';
import { C, SVG_FONT } from '@/theme';
import type { Zone } from '@/types/game';
import { TAU, polar } from '@/utils/math';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Face graduée qui tourne avec le doigt : crans tous les 2°, chiffres tous les 30°. */
const DialFace = memo(function DialFace({ size, accent }: { size: number; accent: string }) {
  const c = size / 2;
  const R = size / 2;
  const { minor, mid, major, labels } = useMemo(() => {
    let mi = '';
    let md = '';
    let ma = '';
    for (let i = 0; i < 360 / DETENT_DEG; i++) {
      const a = i * DETENT_DEG;
      const isMajor = a % 30 === 0;
      const isMid = !isMajor && a % 10 === 0;
      const p1 = polar(c, c, R * (isMajor ? 0.8 : isMid ? 0.85 : 0.88), a);
      const p2 = polar(c, c, R * 0.93, a);
      const seg = `M${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L${p2.x.toFixed(2)} ${p2.y.toFixed(2)} `;
      if (isMajor) ma += seg;
      else if (isMid) md += seg;
      else mi += seg;
    }
    const l = Array.from({ length: 12 }, (_, i) => {
      const a = i * 30;
      const p = polar(c, c, R * 0.68, a);
      return { a, x: p.x, y: p.y };
    });
    return { minor: mi, mid: md, major: ma, labels: l };
  }, [c, R]);
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={R} fill="#0A0A0B" />
      <Path d={minor} stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={1} strokeLinecap="round" />
      <Path d={mid} stroke="#FFFFFF" strokeOpacity={0.38} strokeWidth={1.4} strokeLinecap="round" />
      <Path d={major} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={2} strokeLinecap="round" />
      {labels.map((l) => (
        <SvgText
          key={l.a}
          x={l.x}
          y={l.y + size * 0.018}
          fontSize={size * 0.052}
          fontWeight="600"
          fontFamily={SVG_FONT}
          fill={l.a === 0 ? accent : C.text2}
          textAnchor="middle"
          rotation={l.a}
          origin={`${l.x}, ${l.y}`}
        >
          {l.a.toString()}
        </SvgText>
      ))}
      <Circle cx={c} cy={c} r={R * 0.46} fill={C.surface2} />
      <Circle cx={c} cy={c} r={R * 0.06} fill={C.surface4} />
      <Path d={`M${c} ${c - R * 0.4} L${c} ${c - R * 0.26}`} stroke={accent} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
});

/** Anneau de crans du mécanisme interne, contre-rotatif (détail mécanique discret). */
const MechanismRing = memo(function MechanismRing({ size }: { size: number }) {
  const r = size / 2 - 1;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.text3} strokeWidth={1.5} strokeDasharray="1.5 7" strokeLinecap="round" fill="none" />
    </Svg>
  );
});

/**
 * Le cadran du coffre. Le joueur le fait tourner en traçant un cercle avec le doigt.
 * La lueur d'ancrage est identique pour un vrai point et un leurre : seule la vibration les distingue.
 */
export function LockDial({ size, engine, accent, markers }: { size: number; engine: LockEngine; accent: string; markers: Zone[] | null }) {
  const faceSize = size * 0.86;
  const faceOffset = (size - faceSize) / 2;
  const mechSize = faceSize * 0.98;
  const rotate = useMemo(
    () => engine.dialAnim.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'], extrapolate: 'extend' }),
    [engine],
  );
  const counter = useMemo(
    () => engine.dialAnim.interpolate({ inputRange: [-360, 360], outputRange: ['720deg', '-720deg'], extrapolate: 'extend' }),
    [engine],
  );
  const holdR = size / 2 - 6;
  const circ = TAU * holdR;
  const dashOffset = useMemo(() => engine.holdAnim.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] }), [engine, circ]);

  return (
    <View style={{ width: size, height: size }}>
      {/* Socle + piste de la jauge de maintien */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill={C.surface} />
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={holdR} stroke={C.surface2} strokeWidth={5} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={holdR}
            stroke={accent}
            strokeWidth={5}
            fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={dashOffset as unknown as number}
            strokeLinecap="round"
          />
        </G>
      </Svg>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          { left: (size - mechSize) / 2, top: (size - mechSize) / 2, width: mechSize, height: mechSize, transform: [{ rotate: counter }] },
        ]}
      >
        <MechanismRing size={mechSize} />
      </Animated.View>

      {/* Face rotative */}
      <Animated.View pointerEvents="none" style={[styles.abs, { left: faceOffset, top: faceOffset, width: faceSize, height: faceSize, transform: [{ rotate }] }]}>
        <DialFace size={faceSize} accent={accent} />
        {markers && markers.length > 0 ? (
          <Svg width={faceSize} height={faceSize} style={StyleSheet.absoluteFill}>
            {markers.map((z) => {
              const p = polar(faceSize / 2, faceSize / 2, faceSize * 0.31, z.angle);
              return <Circle key={z.id} cx={p.x} cy={p.y} r={faceSize * 0.02} fill={z.kind === 'target' ? C.green : C.red} />;
            })}
          </Svg>
        ) : null}
      </Animated.View>

      {/* Lueur d'ancrage */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          {
            left: faceOffset - 2,
            top: faceOffset - 2,
            width: faceSize + 4,
            height: faceSize + 4,
            borderRadius: (faceSize + 4) / 2,
            borderWidth: 2,
            borderColor: accent,
            opacity: engine.glowAnim,
          },
        ]}
      />

      {/* Repère fixe en haut */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path
          d={`M${size / 2 - 7} ${faceOffset - 1} L${size / 2 + 7} ${faceOffset - 1} L${size / 2} ${faceOffset + 10} Z`}
          fill={accent}
          strokeLinejoin="round"
        />
      </Svg>

      {/* Surface tactile sans enfant : locationX/Y toujours relatifs à elle */}
      <View
        style={[styles.abs, { left: 0, top: 0, width: size, height: size, borderRadius: size / 2 }]}
        {...engine.pan.panHandlers}
        accessibilityLabel="Cadran du coffre-fort. Faites glisser votre doigt en cercle pour tourner."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
});
