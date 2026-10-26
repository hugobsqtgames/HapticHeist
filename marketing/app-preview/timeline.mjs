/**
 * Haptic Heist — App Store Preview : la timeline.
 *
 * Source unique de vérité, partagée par le compositeur (navigateur) et par la
 * bande-son (Node) : plans, correspondance temps vidéo → image de l'app réelle,
 * caméra, textes, ondes haptiques, couleurs d'ambiance.
 * Tous les temps sont en secondes vidéo.
 */

export const FPS = 30;
export const WIDTH = 886; // App Store : iPhone 6,9" / 6,5", portrait
export const HEIGHT = 1920;
export const DURATION = 29.9;
export const FRAMES = Math.round(DURATION * FPS);

/** Palette de l'app (src/theme/colors.ts). */
export const COLORS = {
  bg: '#000000',
  text: '#F5F5F7',
  text2: '#A1A1A6',
  gold: '#F5B942',
  red: '#FF453A',
  blue: '#0A84FF',
  surface2: '#1C1C1E',
};

/** Géométrie de l'iPhone dessiné (en px vidéo). L'écran garde le ratio 393 × 852 de l'app capturée. */
export const PHONE = {
  screenW: 560,
  screenH: Math.round((560 * 852) / 393), // 1214
  bezel: 17,
  pt: 560 / 393, // 1 point iOS en px vidéo
};
PHONE.w = PHONE.screenW + PHONE.bezel * 2;
PHONE.h = PHONE.screenH + PHONE.bezel * 2;

/* ───────────────────────── Courbes ───────────────────────── */

export const EASE = {
  linear: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  inOutQuint: (x) => (x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2),
  outBack: (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2),
};

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Piste d'images-clés : [{ t, ...valeurs, ease }]. Les valeurs absentes sont
 * reprises de la clé précédente ; `ease` décrit le segment qui mène à la clé.
 */
export function track(keys) {
  const full = [];
  let prev = {};
  for (const k of keys) {
    const { t, ease, ...vals } = k;
    prev = { ...prev, ...vals };
    full.push({ t, ease: ease || 'inOutCubic', v: { ...prev } });
  }
  return (time) => {
    if (time <= full[0].t) return full[0].v;
    for (let i = 1; i < full.length; i++) {
      const a = full[i - 1];
      const b = full[i];
      if (time <= b.t) {
        const x = b.t === a.t ? 1 : EASE[b.ease]((time - a.t) / (b.t - a.t));
        const out = {};
        for (const key of Object.keys(b.v)) {
          const va = a.v[key] ?? b.v[key];
          out[key] = typeof b.v[key] === 'number' ? lerp(va, b.v[key], x) : x < 1 ? va : b.v[key];
        }
        return out;
      }
    }
    return full[full.length - 1].v;
  };
}

/** Correspondance linéaire par morceaux temps vidéo → image de la capture. */
export function frameMap(points) {
  return (t) => {
    if (t <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [t0, f0] = points[i - 1];
      const [t1, f1] = points[i];
      if (t <= t1) return Math.round(t1 === t0 ? f1 : f0 + ((f1 - f0) * (t - t0)) / (t1 - t0));
    }
    return points[points.length - 1][1];
  };
}

/* ───────────────────────── Montage des captures ───────────────────────── */
/*
 * Repères des captures (voir .cache/clips/clips.json) :
 *   hero  : accueil 0 · tap « Lancer » 195 · fiche montée 233 · tap « Commencer » 234 ·
 *           décompte 235–297 · GO 298 · doigt posé 313 · ancrage 395 · ouvert 424 · révélation 453
 *   decoy : doigt posé 6 · leurre 54 · alarme 74 · 3ᵉ alarme 256 · Arrêté 303
 *   veteran : Butin 0–101 · Tutoriel 102–179 · Réglages 180–257
 */
export const HERO_MAP = frameMap([
  [0, 20],
  [5.833, 195], // temps réel
  [7.1, 233], // la fiche Mission monte (vraie transition)
  [8.55, 233], // écran statique : on s'y attarde
  [8.58, 234],
  [9.63, 297], // compte à rebours ×2
  [9.66, 298],
  [19.3, 585], // temps réel : cadran, ancrage, maintien, révélation
]);

export const DECOY_MAP = frameMap([
  [19.3, 16],
  [22.1, 100],
]);
export const BUSTED_MAP = frameMap([
  [22.1, 262], // 3ᵉ alarme : stroboscope rouge
  [24.4, 331], // puis l'écran « Arrêté »
]);

/** Ce qu'affiche l'écran de chaque iPhone au temps t (avec fondus d'écran). */
export const SCREENS = {
  main: [
    { t0: 0, t1: 19.3, clip: 'hero', map: HERO_MAP },
    { t0: 19.3, t1: 22.1, clip: 'decoy', map: DECOY_MAP },
    { t0: 22.1, t1: 24.4, clip: 'decoy', map: BUSTED_MAP, fade: 0.16 },
    { t0: 24.4, t1: 99, clip: 'veteran', map: frameMap([[0, 70]]), fade: 0.3 },
  ],
  left: [{ t0: 0, t1: 99, clip: 'veteran', map: frameMap([[0, 150]]) }],
  right: [{ t0: 0, t1: 99, clip: 'veteran', map: frameMap([[0, 236]]) }],
};

/** Point de l'écran (0–1) du logo, du cadran, etc., résolus depuis clips.json. */
export const FOCUS = {
  center: [0.5, 0.5],
  security: [0.5, 0.335],
  loot: [0.5, 0.385],
  statusPins: [0.5, 0.17],
};

/* ───────────────────────── Caméra ───────────────────────── */

const REST = { fu: 0.5, fv: 0.5, x: 443, y: 1238, s: 1, ry: 0, rx: 0, o: 1, blur: 0 };

/** Caméra de l'iPhone principal. `fu/fv` : point de l'écran placé en (x, y) à l'échelle s. */
export const cameraMain = (F) =>
  track([
    { t: 0, ...REST, fu: F.logo[0], fv: F.logo[1], x: 443, y: 930, s: 4.4 },
    { t: 2.9, s: 3.75, y: 945, ease: 'linear' },
    { t: 4.35, ...REST, ry: -11, rx: 4, ease: 'inOutQuint' },
    { t: 5.75, ry: -4, rx: 2, s: 1.02, ease: 'outCubic' },
    // Mission : zoom sur le bloc Sécurité
    { t: 6.55, ry: 0, rx: 0, s: 1 },
    { t: 7.5, fu: FOCUS.security[0], fv: FOCUS.security[1], x: 443, y: 1110, s: 1.42, ease: 'inOutQuint' },
    { t: 8.25, s: 1.46, y: 1104, ease: 'linear' },
    { t: 8.95, ...REST, ry: 7, rx: 2, ease: 'inOutQuint' },
    // Le cadran : la caméra s'approche pendant que le doigt cherche
    { t: 10.0, ry: 2, rx: 0, ease: 'outCubic' },
    { t: 12.4, fu: F.dial[0], fv: F.dial[1], x: 443, y: 1300, s: 1.22, ry: 0, ease: 'inOutCubic' },
    { t: 13.75, s: 1.26, y: 1296, ease: 'linear' },
    { t: 14.55, ...REST, ry: -5, rx: 2, ease: 'inOutQuint' },
    // Révélation, puis zoom sur le butin
    { t: 16.9, ry: 3, s: 1.03, ease: 'inOutCubic' },
    { t: 17.75, fu: FOCUS.loot[0], fv: FOCUS.loot[1], x: 443, y: 1080, s: 1.36, ry: 0, rx: 0, ease: 'inOutQuint' },
    { t: 18.7, s: 1.39, ease: 'linear' },
    { t: 19.0, ...REST, s: 0.96, ease: 'inOutCubic' },
    // Bascule : l'iPhone pivote sur la tranche, l'écran change à 19,3 s
    { t: 19.3, ry: 89, s: 0.9, ease: 'inCubic' },
    { t: 19.3001, ry: -89 },
    { t: 19.7, ry: 6, s: 1, rx: 2, ease: 'outCubic' },
    // Leurre : zoom sur le statut et les goupilles au moment de l'alarme
    { t: 20.95, ry: 3, rx: 1, ease: 'inOutCubic' },
    { t: 21.45, fu: FOCUS.statusPins[0], fv: FOCUS.statusPins[1], x: 443, y: 905, s: 1.32, ry: 0, rx: 0, ease: 'inOutQuint' },
    { t: 21.95, s: 1.34, ease: 'linear' },
    { t: 22.35, ...REST, ry: -3, ease: 'inOutQuint' },
    { t: 24.25, s: 1.05, ry: 0, ease: 'linear' },
    // Triptyque
    { t: 24.95, ...REST, y: 1300, s: 0.8, ease: 'inOutQuint' },
    { t: 26.95, s: 0.82, y: 1292, ease: 'linear' },
    { t: 27.4, y: 1430, s: 0.76, o: 0, blur: 14, ease: 'inCubic' },
  ]);

/** iPhones latéraux du triptyque. */
export const cameraSide = (side) => {
  const k = side === 'left' ? -1 : 1;
  return track([
    { t: 0, ...REST, x: 443 + k * 700, y: 1320, s: 0.6, ry: -k * 24, o: 0, dim: 0.55 },
    { t: 24.5, x: 443 + k * 700, o: 0 },
    { t: 25.2, x: 443 + k * 262, y: 1320, s: 0.6, ry: -k * 18, o: 1, ease: 'outExpo' },
    { t: 26.95, x: 443 + k * 250, ry: -k * 15, ease: 'linear' },
    { t: 27.35, y: 1460, o: 0, blur: 14, ease: 'inCubic' },
  ]);
};

/* ───────────────────────── Ambiance & textes ───────────────────────── */

/** Halo diffus derrière l'iPhone : couleur de la scène. */
export const GLOW = track([
  { t: 0, r: 245, g: 185, b: 66, a: 0 },
  { t: 3.2, a: 0, ease: 'linear' },
  { t: 4.6, a: 0.2 },
  { t: 19.1, a: 0.2, ease: 'linear' },
  { t: 19.5, r: 10, g: 132, b: 255, a: 0.2 },
  { t: 21.1, a: 0.2, ease: 'linear' },
  { t: 21.4, r: 255, g: 69, b: 58, a: 0.24 },
  { t: 24.3, a: 0.24, ease: 'linear' },
  { t: 24.8, r: 245, g: 185, b: 66, a: 0.18 },
  { t: 27.0, a: 0.18, ease: 'linear' },
  { t: 27.5, a: 0 },
  { t: 28.6, a: 0.16 },
]);

/**
 * Textes. `*mot*` = mot accentué (couleur `accent`). `pos` : top | bottom | center.
 * in/out : apparition mot par mot (flou → net), sortie en fondu.
 */
export const TEXTS = [
  { in: 0.35, out: 2.05, pos: 'bottom', lines: ['Un coffre-fort.'], stagger: 0.07, size: 0.8 },
  { in: 1.0, out: 2.05, pos: 'bottom', row: 1, lines: ['Aucun indice à l’écran.'], dim: true, size: 0.8 },
  { in: 2.2, out: 3.05, pos: 'bottom', lines: ['Juste une *vibration*.'], size: 0.8 },
  { in: 3.85, out: 5.75, pos: 'top', lines: ['Le casse se joue', '*au toucher*.'] },
  { in: 6.15, out: 8.5, pos: 'top', lines: ['Choisissez', 'votre *cible*.'] },
  { in: 9.85, out: 11.55, pos: 'top', lines: ['Tracez', 'un cercle.'] },
  { in: 11.7, out: 12.8, pos: 'top', lines: ['Sentez le', '*tremblement*.'] },
  { in: 12.92, out: 14.15, pos: 'top', lines: ['Double impulsion.', '*Ne bougez plus.*'] },
  { in: 15.05, out: 18.85, pos: 'top', lines: ['Chaque coffre', 'cache *un trésor*.'] },
  { in: 19.75, out: 22.0, pos: 'top', lines: ['Méfiez-vous', 'des *leurres*.'], accent: 'red' },
  { in: 22.25, out: 24.25, pos: 'top', lines: ['Trois erreurs.', '*Arrêté.*'], accent: 'red' },
  { in: 24.7, out: 27.1, pos: 'top', lines: ['Une collection', 'qui *grandit*.'], sub: 'Tutoriel · Réglages haptiques · Mode aveugle' },
  { in: 27.3, out: 28.35, pos: 'center', lines: ['100 % hors ligne.', 'Sans compte.', 'Sans pub.'], stagger: 0.18, lineStagger: true, size: 0.82 },
];

/** Plan d'ouverture : masque circulaire qui isole le logo, puis s'ouvre pendant le recul. */
// Rayons en px de l'image finale : le cercle garde sa taille à l'écran pendant que la caméra
// recule, puis s'ouvre comme un diaphragme quand l'iPhone apparaît.
export const MACRO_MASK = track([
  { t: 0, inner: 405, outer: 565, o: 1 },
  { t: 3.3, inner: 405, outer: 565, o: 1, ease: 'linear' },
  { t: 4.25, inner: 900, outer: 1500, o: 1, ease: 'inOutCubic' },
  { t: 4.45, o: 0, ease: 'linear' },
]);

/** Captures d'écran App Store (6,9") tirées des mêmes plans que la vidéo. */
export const SCREENSHOTS = [
  { t: 5.2, name: '01-au-toucher' },
  { t: 13.62, name: '02-double-impulsion' },
  { t: 18.45, name: '03-tresor' },
  { t: 21.75, name: '04-leurres' },
  { t: 8.2, name: '05-mission' },
  { t: 26.4, name: '06-collection' },
];

/** Signature finale. */
export const END_CARD = { in: 28.5, ringsAt: 28.75, title: 'Haptic Heist', tagline: 'Le crochetage au bout des doigts.', cta: 'Ouvrez votre premier coffre.' };

/**
 * Ondes haptiques : `count` anneaux espacés de `gap` s (2 = double impulsion du vrai point,
 * 1 = choc sec d'un leurre, 3 = déverrouillage / alarme). `at` : point d'écran ou 'icon'.
 * Les événements de l'app sont convertis en temps vidéo à partir de clips.json.
 */
export const RINGS = (F, ev) => [
  { t: 2.42, at: F.logo, count: 2, gap: 0.13, color: 'gold', size: 0.36 },
  { t: ev.heroAnchor, at: F.dial, count: 2, gap: 0.13, color: 'gold', size: 0.9 },
  { t: ev.heroUnlock, at: F.dial, count: 3, gap: 0.12, color: 'gold', size: 0.9 },
  { t: ev.decoyAnchor, at: F.dial2, count: 1, gap: 0, color: 'gold', size: 0.9 },
  { t: ev.decoyTrap, at: F.dial2, count: 3, gap: 0.12, color: 'red', size: 0.9 },
  { t: END_CARD.ringsAt, at: 'icon', count: 2, gap: 0.13, color: 'gold', size: 1 },
];

/** Temps vidéo d'une image de capture, via la correspondance (première occurrence). */
export function videoTimeOf(map, frame, t0, t1) {
  for (let t = t0; t <= t1; t += 1 / (FPS * 4)) if (map(t) >= frame) return t;
  return null;
}

/** Résout les points d'intérêt et les temps d'événements depuis clips.json. */
export function resolve(clips) {
  const pt = (clip, x, y) => [x / clips[clip].viewport.width, y / clips[clip].viewport.height];
  const dialC = (clip) => {
    const d = clips[clip].dial;
    return pt(clip, d.x + d.width / 2, d.y + d.height / 2);
  };
  const lb = clips.logo.logo;
  // Les deux casses partagent la même mise en page : le cadran est au même endroit.
  if (!clips.hero.dial) clips.hero.dial = clips.decoy.dial;
  const F = { logo: pt('hero', lb.x + lb.width / 2, lb.y + lb.height / 2), dial: dialC('hero'), dial2: dialC('decoy') };
  const evf = (clip, type, n = 0) => clips[clip].events.filter((e) => e.type === type)[n].frame;
  const ev = {
    heroAnchor: videoTimeOf(HERO_MAP, evf('hero', 'anchor'), 9, 19.3),
    heroUnlock: videoTimeOf(HERO_MAP, evf('hero', 'unlock'), 9, 19.3),
    heroSuccess: videoTimeOf(HERO_MAP, evf('hero', 'screen:success'), 9, 19.3),
    decoyAnchor: videoTimeOf(DECOY_MAP, evf('decoy', 'anchor'), 19.3, 22.1),
    decoyTrap: videoTimeOf(DECOY_MAP, evf('decoy', 'trap'), 19.3, 22.1),
  };
  return { F, ev };
}
