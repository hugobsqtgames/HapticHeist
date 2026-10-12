import { Platform, TextStyle } from 'react-native';

import { C } from './colors';

/** Échelle typographique calquée sur les tailles dynamiques iOS (police système). */
export const T = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', color: C.text, letterSpacing: 0.2 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: C.text },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: C.text },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', color: C.text },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: C.text },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', color: C.text },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', color: C.text },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400', color: C.text2 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', color: C.text2 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: C.text3 },
  overline: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.6 },
} satisfies Record<string, TextStyle>;

/** Police des textes SVG : la police système, y compris en aperçu web. */
export const SVG_FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", sans-serif' : undefined;
