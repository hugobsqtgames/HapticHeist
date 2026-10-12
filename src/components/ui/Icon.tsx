import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { C } from '@/theme';

export type IconName =
  | 'home'
  | 'vault'
  | 'finger'
  | 'settings'
  | 'play'
  | 'pause'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'coin'
  | 'eye'
  | 'eye-off'
  | 'siren'
  | 'check'
  | 'clock'
  | 'shield'
  | 'wave'
  | 'target'
  | 'trash'
  | 'lock'
  | 'sparkle'
  | 'skip';

/** Icônes linéaires maison (trait 1,8, extrémités arrondies), dans l'esprit SF Symbols. */
export function Icon({ name, size = 24, color = C.text, strokeWidth = 1.8 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  let body: React.ReactNode = null;
  switch (name) {
    case 'home':
      body = <Path d="M3.5 10.5 L12 3.5 L20.5 10.5 V19.5 A1.5 1.5 0 0 1 19 21 H14.5 V15 H9.5 V21 H5 A1.5 1.5 0 0 1 3.5 19.5 Z" {...p} />;
      break;
    case 'vault':
      body = (
        <>
          <Rect x={3} y={4} width={18} height={15} rx={3} {...p} />
          <Circle cx={12} cy={11.5} r={3.6} {...p} />
          <Path d="M12 7.9 V9 M12 14 V15.1 M8.4 11.5 H9.5 M14.5 11.5 H15.6 M7 19 V21 M17 19 V21" {...p} />
        </>
      );
      break;
    case 'finger':
      body = (
        <>
          <Path d="M6.8 18.5 C5.6 16.4 5.2 14 5.2 11.6 C5.2 7.6 8.2 4.5 12 4.5 C15.8 4.5 18.8 7.6 18.8 11.6" {...p} />
          <Path d="M9.4 20 C8.6 18 8.4 15.6 8.4 12.2 C8.4 9.9 10 8 12 8 C14 8 15.6 9.9 15.6 12.2 C15.6 14.2 15.5 15.8 15.1 17.4" {...p} />
          <Path d="M12 11.6 C12 14.6 12.1 17.4 13 20.2" {...p} />
        </>
      );
      break;
    case 'settings':
      body = (
        <>
          <Circle cx={12} cy={12} r={3} {...p} />
          <Path
            d="M12 2.8 V5.2 M12 18.8 V21.2 M2.8 12 H5.2 M18.8 12 H21.2 M5.5 5.5 L7.2 7.2 M16.8 16.8 L18.5 18.5 M5.5 18.5 L7.2 16.8 M16.8 7.2 L18.5 5.5"
            {...p}
          />
          <Circle cx={12} cy={12} r={6.8} {...p} />
        </>
      );
      break;
    case 'play':
      body = <Path d="M8 5.5 L18.5 12 L8 18.5 Z" fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />;
      break;
    case 'pause':
      body = (
        <>
          <Rect x={7} y={5.5} width={3} height={13} rx={1} fill={color} />
          <Rect x={14} y={5.5} width={3} height={13} rx={1} fill={color} />
        </>
      );
      break;
    case 'chevron-left':
      body = <Path d="M14.5 5.5 L8 12 L14.5 18.5" {...p} strokeWidth={strokeWidth + 0.4} />;
      break;
    case 'chevron-right':
      body = <Path d="M9.5 5.5 L16 12 L9.5 18.5" {...p} />;
      break;
    case 'close':
      body = <Path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" {...p} strokeWidth={strokeWidth + 0.3} />;
      break;
    case 'coin':
      body = (
        <>
          <Circle cx={12} cy={12} r={8.5} {...p} />
          <Path d="M14.6 9.2 C14 8.4 13.1 8 12 8 C10.5 8 9.4 8.8 9.4 10 C9.4 12.6 14.6 11.4 14.6 14 C14.6 15.2 13.5 16 12 16 C10.8 16 9.8 15.5 9.2 14.6 M12 6.5 V8 M12 16 V17.5" {...p} />
        </>
      );
      break;
    case 'eye':
      body = (
        <>
          <Path d="M2.5 12 C5 7.5 8.3 5.5 12 5.5 C15.7 5.5 19 7.5 21.5 12 C19 16.5 15.7 18.5 12 18.5 C8.3 18.5 5 16.5 2.5 12 Z" {...p} />
          <Circle cx={12} cy={12} r={3} {...p} />
        </>
      );
      break;
    case 'eye-off':
      body = (
        <>
          <Path d="M9.9 5.8 C10.6 5.6 11.3 5.5 12 5.5 C15.7 5.5 19 7.5 21.5 12 C20.7 13.4 19.8 14.6 18.8 15.5 M14.1 18.2 C13.4 18.4 12.7 18.5 12 18.5 C8.3 18.5 5 16.5 2.5 12 C3.4 10.4 4.4 9.1 5.6 8.1" {...p} />
          <Path d="M4 4 L20 20" {...p} />
        </>
      );
      break;
    case 'siren':
      body = (
        <>
          <Path d="M6.5 17.5 V12.5 C6.5 9.5 9 7 12 7 C15 7 17.5 9.5 17.5 12.5 V17.5 Z" {...p} />
          <Path d="M4.5 20.5 H19.5 M12 2.5 V4 M4.8 5 L5.9 6.1 M19.2 5 L18.1 6.1" {...p} />
        </>
      );
      break;
    case 'check':
      body = <Path d="M5 12.5 L10 17.5 L19 7" {...p} strokeWidth={strokeWidth + 0.4} />;
      break;
    case 'clock':
      body = (
        <>
          <Circle cx={12} cy={12} r={8.5} {...p} />
          <Path d="M12 7.5 V12 L15 14" {...p} />
        </>
      );
      break;
    case 'shield':
      body = <Path d="M12 3 L19 5.8 V11.5 C19 15.8 16 19.2 12 21 C8 19.2 5 15.8 5 11.5 V5.8 Z" {...p} />;
      break;
    case 'wave':
      body = <Path d="M2.5 12 H5.5 L7.5 7 L10.5 17 L13.5 5 L16.5 19 L18.5 10 L19.8 12 H21.5" {...p} />;
      break;
    case 'target':
      body = (
        <>
          <Circle cx={12} cy={12} r={8.5} {...p} />
          <Circle cx={12} cy={12} r={4} {...p} />
          <Circle cx={12} cy={12} r={0.6} fill={color} stroke={color} />
        </>
      );
      break;
    case 'trash':
      body = <Path d="M4.5 6.5 H19.5 M9.5 6.5 V4.5 H14.5 V6.5 M6.5 6.5 L7.4 19.2 A1.5 1.5 0 0 0 8.9 20.5 H15.1 A1.5 1.5 0 0 0 16.6 19.2 L17.5 6.5 M10 10.5 V16.5 M14 10.5 V16.5" {...p} />;
      break;
    case 'lock':
      body = (
        <>
          <Rect x={5} y={10.5} width={14} height={10} rx={2.5} {...p} />
          <Path d="M8.5 10.5 V7.5 A3.5 3.5 0 0 1 15.5 7.5 V10.5" {...p} />
        </>
      );
      break;
    case 'sparkle':
      body = <Path d="M12 3 C12.6 8.2 15.8 11.4 21 12 C15.8 12.6 12.6 15.8 12 21 C11.4 15.8 8.2 12.6 3 12 C8.2 11.4 11.4 8.2 12 3 Z" {...p} />;
      break;
    case 'skip':
      body = <Path d="M6 6 L13.5 12 L6 18 Z M17.5 6 V18" {...p} />;
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {body}
    </Svg>
  );
}
