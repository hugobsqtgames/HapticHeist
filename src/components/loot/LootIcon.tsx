import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

import { C, alpha } from '@/theme';
import type { LootKind } from '@/types/game';
import { polar } from '@/utils/math';

/** Assombrit (f < 0) ou éclaircit (f > 0) une couleur #RRGGBB. */
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((x) => Math.round(f < 0 ? x * (1 + f) : x + (255 - x) * f));
  return `#${ch.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

const GOLD = '#F2C14E';
const GOLD_DARK = '#C9932B';

/** Pictogrammes à plat des 12 familles d'objets (deux tons par objet, aucun reflet). */
export const LootIcon = memo(function LootIcon({ kind, hue, size = 48 }: { kind: LootKind; hue: string; size?: number }) {
  const main = hue;
  const dark = shade(hue, -0.35);
  let body: React.ReactNode = null;
  switch (kind) {
    case 'gem':
      body = (
        <G>
          <Polygon points="14,24 23,13 41,13 50,24 32,54" fill={main} />
          <Polygon points="14,24 50,24 32,54" fill={dark} />
          <Polygon points="23,13 32,24 41,13" fill={shade(hue, 0.25)} />
        </G>
      );
      break;
    case 'crown':
      body = (
        <G>
          <Path d="M10 46 L8 18 L21 30 L32 12 L43 30 L56 18 L54 46 Z" fill={GOLD} />
          <Rect x={10} y={44} width={44} height={8} rx={2} fill={GOLD_DARK} />
          <Circle cx={32} cy={36} r={4} fill={C.red} />
          <Circle cx={20} cy={38} r={2.6} fill={C.blue} />
          <Circle cx={44} cy={38} r={2.6} fill={C.green} />
        </G>
      );
      break;
    case 'necklace':
      body = (
        <G>
          <Path d="M12 12 C14 36 50 36 52 12" stroke={GOLD_DARK} strokeWidth={2} fill="none" />
          {Array.from({ length: 9 }).map((_, i) => {
            const t = i / 8;
            return <Circle key={i} cx={12 + t * 40} cy={12 + Math.sin(t * Math.PI) * 18} r={2.8} fill="#EDE6D6" />;
          })}
          <Polygon points="32,34 40,43 32,56 24,43" fill={main} />
        </G>
      );
      break;
    case 'painting':
      body = (
        <G>
          <Rect x={6} y={10} width={52} height={44} rx={3} fill={GOLD_DARK} />
          <Rect x={11} y={15} width={42} height={34} rx={1.5} fill="#1E1A16" />
          <Path d="M11 43 L24 29 L32 37 L41 25 L53 40 V49 H11 Z" fill={main} />
          <Circle cx={22} cy={23} r={4} fill={GOLD} />
        </G>
      );
      break;
    case 'gold':
      body = (
        <G>
          {[
            [8, 38],
            [30, 38],
            [19, 24],
          ].map(([x, y], i) => (
            <G key={i}>
              <Polygon points={`${x},${y + 14} ${x + 4},${y} ${x + 22},${y} ${x + 26},${y + 14}`} fill={i === 2 ? GOLD : GOLD_DARK} />
              <Rect x={x + 4} y={y} width={18} height={3} fill={shade(GOLD, 0.3)} />
            </G>
          ))}
        </G>
      );
      break;
    case 'watch':
      body = (
        <G>
          <Rect x={29} y={4} width={6} height={7} rx={1.5} fill={GOLD_DARK} />
          <Circle cx={32} cy={34} r={21} fill={GOLD} />
          <Circle cx={32} cy={34} r={16.5} fill="#F2EEE4" />
          {Array.from({ length: 12 }).map((_, i) => {
            const p1 = polar(32, 34, 13.5, i * 30);
            const p2 = polar(32, 34, 15.5, i * 30);
            return <Line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#3A3226" strokeWidth={1.2} strokeLinecap="round" />;
          })}
          <Path d="M32 34 V23 M32 34 L40 38" stroke="#1A1208" strokeWidth={1.8} strokeLinecap="round" />
        </G>
      );
      break;
    case 'statue':
      body = (
        <G>
          <Rect x={18} y={50} width={28} height={7} rx={2} fill={GOLD_DARK} />
          <Circle cx={32} cy={14} r={6} fill={main} />
          <Path d="M24 50 C22 38 24 26 32 22 C40 26 42 38 40 50 Z" fill={dark} />
          <Path d="M26 30 L16 22 M38 30 L48 22" stroke={main} strokeWidth={3.2} strokeLinecap="round" />
        </G>
      );
      break;
    case 'egg':
      body = (
        <G>
          <Ellipse cx={32} cy={32} rx={17} ry={22} fill={main} />
          <Path d="M15.5 29 C24 35 40 35 48.5 29 M16.5 39 C25 45 39 45 47.5 39" stroke={GOLD} strokeWidth={2.4} fill="none" />
          <Rect x={26} y={53} width={12} height={5} rx={1.5} fill={GOLD_DARK} />
        </G>
      );
      break;
    case 'scroll':
      body = (
        <G>
          <Rect x={14} y={12} width={36} height={40} fill="#E6DAB8" />
          <Rect x={10} y={8} width={44} height={6} rx={3} fill={GOLD_DARK} />
          <Rect x={10} y={50} width={44} height={6} rx={3} fill={GOLD_DARK} />
          {Array.from({ length: 6 }).map((_, i) => (
            <Line key={i} x1={19} y1={20 + i * 5} x2={45 - (i % 2) * 6} y2={20 + i * 5} stroke="#8B7A55" strokeWidth={1.2} strokeLinecap="round" />
          ))}
          <Circle cx={40} cy={44} r={4} fill={C.red} />
        </G>
      );
      break;
    case 'scepter':
      body = (
        <G>
          <Path d="M20 56 L40 18" stroke={GOLD_DARK} strokeWidth={4.5} strokeLinecap="round" />
          <Circle cx={42} cy={14} r={8} fill={main} />
          <Circle cx={27} cy={43} r={2.8} fill={C.red} />
        </G>
      );
      break;
    case 'ring':
      body = (
        <G>
          <Ellipse cx={32} cy={40} rx={17} ry={14} fill="none" stroke={GOLD} strokeWidth={5} />
          <Polygon points="24,22 28,14 36,14 40,22 32,30" fill={main} />
        </G>
      );
      break;
    case 'vase':
      body = (
        <G>
          <Path d="M24 8 H40 L38 16 C50 24 50 44 40 54 H24 C14 44 14 24 26 16 Z" fill={main} />
          <Path d="M19 30 C27 34 37 34 45 30 M18.5 40 C27 44 37 44 45.5 40" stroke={dark} strokeWidth={2.2} fill="none" />
        </G>
      );
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden>
      {body}
    </Svg>
  );
});

/** Pictogramme posé sur une pastille teintée de sa couleur. */
export function LootBadge({ kind, hue, size = 52 }: { kind: LootKind; hue: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.27, backgroundColor: alpha(hue.length === 7 ? hue : C.gold, 0.14), alignItems: 'center', justifyContent: 'center' }}>
      <LootIcon kind={kind} hue={hue} size={size * 0.72} />
    </View>
  );
}
