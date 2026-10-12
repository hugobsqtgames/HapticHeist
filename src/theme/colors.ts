import type { TextStyle } from 'react-native';

/**
 * Palette : noir OLED, surfaces grises en couches, une seule couleur d'accent.
 * Les couleurs sémantiques (succès, alerte, info) suivent les teintes système iOS.
 */
export const C = {
  black: '#000000',
  bg: '#000000',
  surface: '#0E0E10',
  surface2: '#1C1C1E',
  surface3: '#2C2C2E',
  surface4: '#3A3A3C',
  separator: 'rgba(255,255,255,0.08)',
  text: '#F5F5F7',
  text2: '#A1A1A6',
  text3: '#6C6C70',
  gold: '#F5B942',
  goldSoft: 'rgba(245,185,66,0.14)',
  onGold: '#1A1405',
  red: '#FF453A',
  redSoft: 'rgba(255,69,58,0.14)',
  green: '#30D158',
  greenSoft: 'rgba(48,209,88,0.14)',
  blue: '#0A84FF',
  blueSoft: 'rgba(10,132,255,0.14)',
  purple: '#BF5AF2',
} as const;

/** Chiffres à chasse fixe : les compteurs et chronos ne « dansent » pas. */
export const NUM: TextStyle = { fontVariant: ['tabular-nums'] };

/** Ajoute une opacité (0–1) à une couleur hexadécimale #RRGGBB. */
export const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0')}`;
