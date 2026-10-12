/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                          H A P T I C   H E I S T                     ║
 * ║        Casse sensoriel 100 % hors ligne — Expo Go (SDK 57) — App.tsx  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Tout est dessiné en code (SVG + Animated), tout le son est synthétisé en
 * code (PCM → WAV → cache local), tout est stocké sur l'appareil.
 * Aucun réseau, aucun compte, aucune publicité, aucun asset externe.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  BackHandler,
  Easing,
  FlatList,
  PanResponder,
  PanResponderInstance,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Pattern,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

/* ════════════════════════════════════════════════════════════════════════
 * 1. DIRECTION ARTISTIQUE
 * ════════════════════════════════════════════════════════════════════════ */

const C = {
  black: '#000000',
  bg: '#030405',
  panel: '#0B0D11',
  panel2: '#12151B',
  panel3: '#1A1E26',
  line: '#232934',
  lineHi: '#323A48',
  steel: '#8C95A3',
  steelHi: '#DCE2EA',
  steelMid: '#5A6371',
  steelDark: '#2A3039',
  gold: '#E8B04B',
  goldHi: '#FFE6A8',
  goldMid: '#C98F2E',
  goldDeep: '#7A5113',
  red: '#FF2E3F',
  redHi: '#FF7A84',
  redDeep: '#5E0710',
  blue: '#2F7BFF',
  blueDeep: '#06205A',
  cctv: '#5CFFB0',
  cctvDim: '#1C5E43',
  cctvDeep: '#06261A',
  text: '#ECEFF4',
  textDim: '#9098A6',
  textMute: '#586070',
};

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;
const DISPLAY = Platform.select({
  ios: 'AvenirNextCondensed-Heavy',
  android: 'sans-serif-condensed',
  default: "'Arial Narrow', 'Helvetica Neue', Arial, sans-serif",
}) as string;

const RARITY_META: Record<Rarity, { label: string; color: string; mult: number }> = {
  commun: { label: 'COMMUN', color: '#9BA4B2', mult: 1 },
  rare: { label: 'RARE', color: '#4FA3FF', mult: 2.2 },
  epique: { label: 'ÉPIQUE', color: '#B36BFF', mult: 4.5 },
  legendaire: { label: 'LÉGENDAIRE', color: C.gold, mult: 10 },
};

/* ════════════════════════════════════════════════════════════════════════
 * 2. TYPES
 * ════════════════════════════════════════════════════════════════════════ */

type ScreenName = 'menu' | 'briefing' | 'heist' | 'success' | 'gameover' | 'vault' | 'tutorial' | 'settings';
type TabName = 'menu' | 'vault' | 'tutorial' | 'settings';
type Rarity = 'commun' | 'rare' | 'epique' | 'legendaire';
type LootKind =
  | 'gem'
  | 'crown'
  | 'necklace'
  | 'painting'
  | 'gold'
  | 'watch'
  | 'statue'
  | 'egg'
  | 'scroll'
  | 'scepter'
  | 'ring'
  | 'vase';

interface LootItem {
  id: string;
  name: string;
  kind: LootKind;
  rarity: Rarity;
  value: number;
  location: string;
  level: number;
  date: number;
  hue: string;
  blind: boolean;
}

interface Settings {
  haptics: boolean;
  sound: boolean;
  ambience: boolean;
  hapticPower: 0 | 1 | 2;
  sensitivity: 0 | 1 | 2;
  blind: boolean;
  cheat: boolean;
  simulator: boolean;
}

interface Career {
  v: number;
  level: number;
  heists: number;
  failures: number;
  totalLoot: number;
  bestTimeMs: number;
  pinsCracked: number;
  trapsTriggered: number;
  loot: LootItem[];
  settings: Settings;
  tutorialDone: boolean;
  createdAt: number;
}

interface Tier {
  name: string;
  type: string;
  city: string;
  safe: string;
  mult: number;
  accent: string;
  fromLevel: number;
}

interface HeistConfig {
  level: number;
  tier: Tier;
  pins: number;
  decoys: number;
  timeLimitMs: number;
  lives: number;
  nearWindow: number;
  lockWindow: number;
  holdMs: number;
  decoyTrapRatio: number;
  lootMin: number;
  lootMax: number;
}

interface HeistResult {
  level: number;
  success: boolean;
  timeMs: number;
  pinsDone: number;
  pinsTotal: number;
  traps: number;
  livesLeft: number;
  reason: 'success' | 'traps' | 'time';
  tierName: string;
  loot?: LootItem;
  lootLostEstimate: number;
}

type ZoneKind = 'target' | 'decoy';
interface Zone {
  id: number;
  angle: number;
  kind: ZoneKind;
}

/* ════════════════════════════════════════════════════════════════════════
 * 3. OUTILS MATHÉMATIQUES & FORMATAGE
 * ════════════════════════════════════════════════════════════════════════ */

const TAU = Math.PI * 2;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const circDist = (a: number, b: number) => {
  const d = Math.abs(mod(a, 360) - mod(b, 360));
  return d > 180 ? 360 - d : d;
};
/** Coordonnées polaires : angle en degrés, 0 = haut, sens horaire. */
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

const groupDigits = (n: number) => {
  const s = Math.round(Math.abs(n)).toString();
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return (n < 0 ? '-' : '') + out;
};
const formatMoney = (n: number) => `${groupDigits(n)} $`;
const formatMoneyShort = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2).replace('.', ',')} Md$`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace('.', ',')} M$`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} k$`;
  return `${Math.round(n)} $`;
};
const formatClock = (ms: number) => {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const d = Math.floor((t % 1000) / 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${d}`;
};
const formatDate = (ts: number) => {
  const d = new Date(ts);
  const p = (x: number) => x.toString().padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Générateur pseudo-aléatoire déterministe (pour la synthèse sonore). */
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* ════════════════════════════════════════════════════════════════════════
 * 4. PERSISTANCE LOCALE ULTRA-ROBUSTE
 *    AsyncStorage + double écriture (principal / sauvegarde) + mémoire vive
 *    de secours + validation stricte du schéma + écritures sérialisées.
 * ════════════════════════════════════════════════════════════════════════ */

const STORAGE_KEY = '@hapticheist/career/v1';
const BACKUP_KEY = '@hapticheist/career/v1:backup';
const SCHEMA_VERSION = 1;
const MAX_LOOT_ITEMS = 600;

const DEFAULT_SETTINGS: Settings = {
  haptics: true,
  sound: true,
  ambience: true,
  hapticPower: 1,
  sensitivity: 1,
  blind: false,
  cheat: false,
  simulator: false,
};

const defaultCareer = (): Career => ({
  v: SCHEMA_VERSION,
  level: 1,
  heists: 0,
  failures: 0,
  totalLoot: 0,
  bestTimeMs: 0,
  pinsCracked: 0,
  trapsTriggered: 0,
  loot: [],
  settings: { ...DEFAULT_SETTINGS },
  tutorialDone: false,
  createdAt: Date.now(),
});

const memoryStore = new Map<string, string>();

const SafeStore = {
  async get(key: string): Promise<string | null> {
    try {
      const v = await AsyncStorage.getItem(key);
      if (v != null) {
        memoryStore.set(key, v);
        return v;
      }
      return memoryStore.get(key) ?? null;
    } catch {
      return memoryStore.get(key) ?? null;
    }
  },
  async set(key: string, value: string): Promise<boolean> {
    memoryStore.set(key, value);
    try {
      await AsyncStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  async remove(key: string): Promise<void> {
    memoryStore.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      /* stockage indisponible : la mémoire vive a déjà été purgée */
    }
  },
};

const num = (v: unknown, fallback: number, lo = -Infinity, hi = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const str = (v: unknown, fallback: string, maxLen = 120) => (typeof v === 'string' ? v.slice(0, maxLen) : fallback);
const oneOf = <T extends string | number>(v: unknown, list: readonly T[], fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

const LOOT_KINDS: readonly LootKind[] = [
  'gem',
  'crown',
  'necklace',
  'painting',
  'gold',
  'watch',
  'statue',
  'egg',
  'scroll',
  'scepter',
  'ring',
  'vase',
];
const RARITIES: readonly Rarity[] = ['commun', 'rare', 'epique', 'legendaire'];

function sanitizeLoot(raw: unknown): LootItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, '');
  if (!name) return null;
  return {
    id: str(r.id, uid(), 40),
    name,
    kind: oneOf(r.kind, LOOT_KINDS, 'gem'),
    rarity: oneOf(r.rarity, RARITIES, 'commun'),
    value: num(r.value, 0, 0, 1e12),
    location: str(r.location, 'Lieu inconnu'),
    level: num(r.level, 1, 1, 999),
    date: num(r.date, Date.now(), 0, 1e14),
    hue: str(r.hue, C.gold, 12),
    blind: bool(r.blind, false),
  };
}

function sanitizeCareer(raw: unknown): Career | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const base = defaultCareer();
  const s = (r.settings && typeof r.settings === 'object' ? r.settings : {}) as Record<string, unknown>;
  const loot = Array.isArray(r.loot)
    ? (r.loot.map(sanitizeLoot).filter(Boolean) as LootItem[]).slice(0, MAX_LOOT_ITEMS)
    : [];
  return {
    v: SCHEMA_VERSION,
    level: Math.floor(num(r.level, base.level, 1, 999)),
    heists: Math.floor(num(r.heists, 0, 0, 1e7)),
    failures: Math.floor(num(r.failures, 0, 0, 1e7)),
    totalLoot: num(r.totalLoot, 0, 0, 1e15),
    bestTimeMs: num(r.bestTimeMs, 0, 0, 1e9),
    pinsCracked: Math.floor(num(r.pinsCracked, 0, 0, 1e8)),
    trapsTriggered: Math.floor(num(r.trapsTriggered, 0, 0, 1e8)),
    loot,
    settings: {
      haptics: bool(s.haptics, DEFAULT_SETTINGS.haptics),
      sound: bool(s.sound, DEFAULT_SETTINGS.sound),
      ambience: bool(s.ambience, DEFAULT_SETTINGS.ambience),
      hapticPower: oneOf(s.hapticPower, [0, 1, 2] as const, DEFAULT_SETTINGS.hapticPower),
      sensitivity: oneOf(s.sensitivity, [0, 1, 2] as const, DEFAULT_SETTINGS.sensitivity),
      blind: bool(s.blind, DEFAULT_SETTINGS.blind),
      cheat: bool(s.cheat, DEFAULT_SETTINGS.cheat),
      simulator: bool(s.simulator, DEFAULT_SETTINGS.simulator),
    },
    tutorialDone: bool(r.tutorialDone, false),
    createdAt: num(r.createdAt, base.createdAt, 0, 1e14),
  };
}

async function loadCareer(): Promise<Career> {
  for (const key of [STORAGE_KEY, BACKUP_KEY]) {
    const raw = await SafeStore.get(key);
    if (!raw) continue;
    try {
      const parsed = sanitizeCareer(JSON.parse(raw));
      if (parsed) return parsed;
    } catch {
      /* JSON corrompu : on tente la clé suivante */
    }
  }
  return defaultCareer();
}

/** File d'écriture sérialisée et anti-rebond : jamais deux écritures simultanées. */
const CareerWriter = {
  pending: null as Career | null,
  timer: null as ReturnType<typeof setTimeout> | null,
  chain: Promise.resolve() as Promise<void>,
  schedule(c: Career) {
    this.pending = c;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, 220);
  },
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const c = this.pending;
    if (!c) return this.chain;
    this.pending = null;
    let json = '';
    try {
      json = JSON.stringify(c);
    } catch {
      return this.chain;
    }
    this.chain = this.chain
      .then(async () => {
        const ok = await SafeStore.set(STORAGE_KEY, json);
        if (ok) await SafeStore.set(BACKUP_KEY, json);
      })
      .catch(() => undefined);
    return this.chain;
  },
  async wipe() {
    this.pending = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.chain;
    await SafeStore.remove(STORAGE_KEY);
    await SafeStore.remove(BACKUP_KEY);
  },
};

/* ════════════════════════════════════════════════════════════════════════
 * 5. BUS DE SIGNAL (alimente le visualiseur d'ondes et le simulateur)
 * ════════════════════════════════════════════════════════════════════════ */

type PulseKind = 'tick' | 'tremor' | 'anchor' | 'decoy' | 'unlock' | 'error' | 'alarm' | 'ui';
type PulseListener = (kind: PulseKind, energy: number, channel: 'haptic' | 'audio') => void;

const PulseBus = {
  haptic: 0,
  audio: 0,
  listeners: new Set<PulseListener>(),
  push(kind: PulseKind, energy: number, channel: 'haptic' | 'audio') {
    if (channel === 'haptic') this.haptic = Math.min(1.4, Math.max(this.haptic, energy));
    else this.audio = Math.min(1.4, Math.max(this.audio, energy));
    this.listeners.forEach((l) => l(kind, energy, channel));
  },
  subscribe(l: PulseListener) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  },
};

/* ════════════════════════════════════════════════════════════════════════
 * 6. MOTEUR HAPTIQUE (expo-haptics)
 * ════════════════════════════════════════════════════════════════════════ */

const swallow = (p: Promise<unknown> | undefined) => {
  if (p && typeof p.catch === 'function') p.catch(() => undefined);
};

const HapticEngine = {
  enabled: true,
  power: 1 as 0 | 1 | 2,
  lastTick: 0,
  lastAny: 0,
  timers: new Set<ReturnType<typeof setTimeout>>(),

  configure(s: Settings) {
    this.enabled = s.haptics;
    this.power = s.hapticPower;
  },
  can() {
    return this.enabled && Platform.OS !== 'web';
  },
  impact(style: Haptics.ImpactFeedbackStyle) {
    if (this.can()) swallow(Haptics.impactAsync(style));
  },
  notify(type: Haptics.NotificationFeedbackType) {
    if (this.can()) swallow(Haptics.notificationAsync(type));
  },
  selection() {
    if (this.can()) swallow(Haptics.selectionAsync());
  },
  later(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  },
  cancelAll() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
  },

  /** Micro-tic d'engrenage, à chaque cran du cadran. */
  tick() {
    const now = Date.now();
    if (now - this.lastTick < 22) return;
    this.lastTick = now;
    PulseBus.push('tick', 0.22, 'haptic');
    if (this.power === 0) this.selection();
    else if (this.power === 1) this.impact(Haptics.ImpactFeedbackStyle.Light);
    else this.impact(Haptics.ImpactFeedbackStyle.Medium);
  },
  /** Tremblement progressif à l'approche d'une zone (closeness 0 → 1). */
  tremor(closeness: number) {
    PulseBus.push('tremor', 0.3 + closeness * 0.45, 'haptic');
    if (closeness < 0.45) this.selection();
    else if (closeness < 0.8 || this.power === 0) this.impact(Haptics.ImpactFeedbackStyle.Soft);
    else this.impact(this.power === 2 ? Haptics.ImpactFeedbackStyle.Rigid : Haptics.ImpactFeedbackStyle.Soft);
  },
  /** Point d'ancrage véritable : double impulsion lourde et feutrée. */
  anchor() {
    PulseBus.push('anchor', 1.1, 'haptic');
    this.notify(Haptics.NotificationFeedbackType.Success);
  },
  /** Leurre : un choc sec unique, plus métallique. */
  decoy() {
    PulseBus.push('decoy', 1.0, 'haptic');
    this.impact(Haptics.ImpactFeedbackStyle.Heavy);
  },
  holdBroken() {
    PulseBus.push('tick', 0.5, 'haptic');
    this.impact(Haptics.ImpactFeedbackStyle.Rigid);
  },
  unlock() {
    PulseBus.push('unlock', 1.3, 'haptic');
    this.notify(Haptics.NotificationFeedbackType.Success);
    this.later(140, () => this.impact(Haptics.ImpactFeedbackStyle.Heavy));
    this.later(260, () => this.impact(Haptics.ImpactFeedbackStyle.Medium));
  },
  error() {
    PulseBus.push('error', 1.3, 'haptic');
    this.notify(Haptics.NotificationFeedbackType.Error);
    this.later(160, () => this.impact(Haptics.ImpactFeedbackStyle.Heavy));
    this.later(300, () => this.impact(Haptics.ImpactFeedbackStyle.Heavy));
  },
  /** Alerte saccadée agressive (Game Over). */
  alarm(bursts = 12) {
    for (let i = 0; i < bursts; i++) {
      this.later(i * 110 + (i % 3 === 2 ? 60 : 0), () => {
        PulseBus.push('alarm', 1.2, 'haptic');
        this.impact(i % 2 === 0 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Rigid);
      });
    }
    this.later(bursts * 115 + 80, () => this.notify(Haptics.NotificationFeedbackType.Error));
  },
  /** Séquence de déverrouillage de la porte du coffre. */
  vaultOpen() {
    [0, 180, 360, 540].forEach((ms) => this.later(ms, () => this.impact(Haptics.ImpactFeedbackStyle.Heavy)));
    this.later(900, () => this.notify(Haptics.NotificationFeedbackType.Success));
    this.later(1800, () => this.impact(Haptics.ImpactFeedbackStyle.Medium));
  },
  ui() {
    PulseBus.push('ui', 0.2, 'haptic');
    this.selection();
  },
};

/* ════════════════════════════════════════════════════════════════════════
 * 7. MOTEUR SONORE — synthèse PCM procédurale → WAV → cache local → expo-audio
 *    (Aucun fichier son livré : chaque son est calculé à la volée.)
 * ════════════════════════════════════════════════════════════════════════ */

const SR = 22050;

type SoundName =
  | 'tick'
  | 'anchor'
  | 'decoy'
  | 'unlock'
  | 'error'
  | 'reset'
  | 'siren'
  | 'alarmOff'
  | 'coins'
  | 'bolt'
  | 'hiss'
  | 'ambience'
  | 'heartbeat'
  | 'ui'
  | 'reveal';

const synth = (dur: number, fn: (t: number, i: number) => number) => {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i);
  return out;
};
const sin = (f: number, t: number) => Math.sin(TAU * f * t);

const SOUND_DEFS: Record<SoundName, { pool: number; loop?: boolean; gen: () => Float32Array }> = {
  tick: {
    pool: 4,
    gen: () => {
      const rnd = mulberry32(11);
      return synth(0.02, (t) => (rnd() * 2 - 1) * 0.45 * Math.exp(-t * 750) + sin(3400, t) * 0.5 * Math.exp(-t * 950));
    },
  },
  anchor: {
    pool: 2,
    gen: () => {
      const rnd = mulberry32(21);
      return synth(
        0.16,
        (t) =>
          0.85 * sin(150, t) * Math.exp(-t * 42) +
          0.3 * (rnd() * 2 - 1) * Math.exp(-t * 650) +
          0.22 * sin(640, t) * Math.exp(-t * 85),
      );
    },
  },
  decoy: {
    pool: 2,
    gen: () => {
      const rnd = mulberry32(31);
      return synth(
        0.08,
        (t) =>
          0.5 * (rnd() * 2 - 1) * Math.exp(-t * 230) +
          0.38 * sin(2150, t) * Math.exp(-t * 150) +
          0.32 * sin(270, t) * Math.exp(-t * 75),
      );
    },
  },
  unlock: {
    pool: 2,
    gen: () => {
      const rnd = mulberry32(41);
      return synth(0.7, (t) => {
        let v = 0.7 * sin(95, t) * Math.exp(-t * 30) + 0.25 * (rnd() * 2 - 1) * Math.exp(-t * 120);
        if (t > 0.08) {
          const u = t - 0.08;
          v += 0.32 * (sin(880, u) + 0.4 * sin(1760, u)) * Math.exp(-u * 8);
        }
        if (t > 0.2) {
          const u = t - 0.2;
          v += 0.32 * (sin(1318.5, u) + 0.4 * sin(2637, u)) * Math.exp(-u * 6);
        }
        return v;
      });
    },
  },
  error: {
    pool: 2,
    gen: () =>
      synth(0.45, (t) => {
        const sq = Math.sign(sin(110, t)) + Math.sign(sin(117, t));
        const env = t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) * 4.5);
        return 0.2 * sq * env;
      }),
  },
  reset: {
    pool: 2,
    gen: () => synth(0.12, (t) => 0.35 * sin(420 - t * 1200, t) * Math.exp(-t * 28)),
  },
  siren: {
    pool: 1,
    loop: true,
    gen: () => {
      // 2 s : 2 cycles de modulation complets + porteuse entière → boucle parfaite.
      const n = Math.floor(2 * SR);
      const out = new Float32Array(n);
      let phase = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const f = 760 + 320 * Math.sin(TAU * t);
        phase += (TAU * f) / SR;
        out[i] = 0.26 * (Math.sin(phase) + 0.35 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase));
      }
      return out;
    },
  },
  alarmOff: {
    pool: 1,
    gen: () =>
      synth(0.46, (t) => {
        const freqs = [1250, 940, 620];
        let v = 0;
        freqs.forEach((f, k) => {
          const st = k * 0.14;
          if (t >= st && t < st + 0.11) {
            const u = t - st;
            const env = Math.min(1, u / 0.005) * Math.min(1, (0.11 - u) / 0.02);
            v += 0.32 * (sin(f, u) + 0.3 * sin(f * 3, u)) * env;
          }
        });
        return v;
      }),
  },
  coins: {
    pool: 2,
    gen: () => {
      const rnd = mulberry32(77);
      const dur = 1.25;
      const n = Math.floor(dur * SR);
      const out = new Float32Array(n);
      for (let k = 0; k < 18; k++) {
        const start = Math.floor(Math.pow(rnd(), 1.4) * 0.85 * SR);
        const f = 2500 + rnd() * 2900;
        const amp = 0.12 + rnd() * 0.14;
        for (let i = start; i < n; i++) {
          const u = (i - start) / SR;
          const env = Math.exp(-u * 20);
          if (env < 0.002) break;
          out[i] += amp * (Math.sin(TAU * f * u) + 0.5 * Math.sin(TAU * f * 2.76 * u)) * env;
        }
      }
      return out;
    },
  },
  bolt: {
    pool: 3,
    gen: () => {
      const rnd = mulberry32(55);
      let lp = 0;
      return synth(0.32, (t) => {
        lp += ((rnd() * 2 - 1) - lp) * 0.08;
        return 0.85 * Math.sin(TAU * (72 - 30 * t) * t) * Math.exp(-t * 15) + 1.8 * lp * Math.exp(-t * 32);
      });
    },
  },
  hiss: {
    pool: 1,
    gen: () => {
      const rnd = mulberry32(66);
      let lp = 0;
      let hp = 0;
      return synth(1.4, (t) => {
        const w = rnd() * 2 - 1;
        lp += (w - lp) * 0.35;
        hp = w - lp;
        const env = Math.min(1, t / 0.12) * Math.exp(-t * 2.2);
        return 0.32 * hp * env + 0.3 * sin(45, t) * Math.exp(-t * 1.6);
      });
    },
  },
  ambience: {
    pool: 1,
    loop: true,
    gen: () => {
      // Boucle de 4 s : toutes les fréquences ont un nombre entier de cycles → sans couture.
      const dur = 4;
      const n = Math.floor(dur * SR);
      const out = new Float32Array(n);
      const rnd = mulberry32(99);
      const air = Array.from({ length: 22 }, () => ({
        f: Math.round((180 + rnd() * 900) * dur) / dur,
        p: rnd() * TAU,
        a: 0.004 + rnd() * 0.006,
      }));
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const swell = 0.75 + 0.25 * Math.sin((TAU * t) / dur);
        let v = (0.09 * sin(55, t) + 0.05 * sin(82.5, t) + 0.025 * sin(110, t) + 0.012 * sin(220.25, t)) * swell;
        for (let k = 0; k < air.length; k++) v += air[k].a * Math.sin(TAU * air[k].f * t + air[k].p);
        out[i] = v;
      }
      return out;
    },
  },
  heartbeat: {
    pool: 1,
    gen: () =>
      synth(0.62, (t) => {
        const thump = (u: number) => (u < 0 ? 0 : sin(52, u) * Math.exp(-u * 16) + 0.4 * sin(104, u) * Math.exp(-u * 30));
        return 0.7 * thump(t) + 0.5 * thump(t - 0.21);
      }),
  },
  ui: {
    pool: 3,
    gen: () => {
      const rnd = mulberry32(5);
      return synth(0.035, (t) => 0.32 * sin(1500, t) * Math.exp(-t * 160) + 0.12 * (rnd() * 2 - 1) * Math.exp(-t * 420));
    },
  },
  reveal: {
    pool: 1,
    gen: () =>
      synth(1.6, (t) => {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        let v = 0;
        notes.forEach((f, k) => {
          const st = k * 0.09;
          if (t >= st) {
            const u = t - st;
            v += 0.14 * (sin(f, u) + 0.3 * sin(f * 2.01, u) + 0.1 * sin(f * 3.98, u)) * Math.exp(-u * 3.2);
          }
        });
        return v;
      }),
  },
};

function encodeWav(samples: Float32Array): Uint8Array {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(clamp(samples[i], -1, 1) * 32767), true);
  return new Uint8Array(buf);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return out;
}

/** Écrit le WAV dans le cache local ; repli en data-URI si le système de fichiers est indisponible. */
function persistWav(name: string, bytes: Uint8Array): string {
  try {
    const f = new File(Paths.cache, `hh_${name}_v1.wav`);
    if (f.exists && f.size === bytes.length) return f.uri;
    if (f.exists) f.delete();
    f.create();
    f.write(bytes);
    return f.uri;
  } catch {
    return `data:audio/wav;base64,${toBase64(bytes)}`;
  }
}

const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0));

const SoundEngine = {
  enabled: true,
  ambienceWanted: true,
  ready: false,
  booting: false,
  players: {} as Partial<Record<SoundName, AudioPlayer[]>>,
  cursor: {} as Partial<Record<SoundName, number>>,
  loops: new Set<SoundName>(),
  loopVolumes: {} as Partial<Record<SoundName, number>>,

  configure(s: Settings) {
    this.enabled = s.sound;
    this.ambienceWanted = s.ambience && s.sound;
    if (!this.enabled) this.loops.forEach((l) => this.pauseLoop(l));
    else this.loops.forEach((l) => this.resumeLoop(l));
    if (!this.ambienceWanted) this.stopLoop('ambience');
  },

  async init() {
    if (this.ready || this.booting) return;
    this.booting = true;
    try {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
    } catch {
      /* mode audio non critique */
    }
    // Les sons courts d'abord pour être jouables au plus vite.
    const order: SoundName[] = [
      'ui',
      'tick',
      'anchor',
      'decoy',
      'reset',
      'unlock',
      'error',
      'bolt',
      'alarmOff',
      'coins',
      'reveal',
      'hiss',
      'heartbeat',
      'siren',
      'ambience',
    ];
    for (const name of order) {
      try {
        const def = SOUND_DEFS[name];
        const uri = persistWav(name, encodeWav(def.gen()));
        const pool: AudioPlayer[] = [];
        for (let i = 0; i < def.pool; i++) {
          const p = createAudioPlayer({ uri });
          p.loop = !!def.loop;
          pool.push(p);
        }
        this.players[name] = pool;
        this.cursor[name] = 0;
        if (this.loops.has(name)) this.resumeLoop(name);
      } catch {
        /* un son manquant ne doit jamais casser le jeu */
      }
      await yieldFrame();
    }
    this.ready = true;
    this.booting = false;
  },

  play(name: SoundName, volume = 1) {
    if (!this.enabled) return;
    PulseBus.push('tick', clamp(volume, 0.1, 1) * (name === 'tick' ? 0.3 : 0.9), 'audio');
    const pool = this.players[name];
    if (!pool || pool.length === 0) return;
    const idx = (this.cursor[name] ?? 0) % pool.length;
    this.cursor[name] = idx + 1;
    const p = pool[idx];
    try {
      p.volume = clamp(volume, 0, 1);
      swallow(p.seekTo(0));
      p.play();
    } catch {
      /* lecteur indisponible */
    }
  },

  startLoop(name: SoundName, volume = 1) {
    this.loops.add(name);
    this.loopVolumes[name] = volume;
    this.resumeLoop(name);
  },
  resumeLoop(name: SoundName) {
    if (!this.enabled) return;
    if (name === 'ambience' && !this.ambienceWanted) return;
    const p = this.players[name]?.[0];
    if (!p) return;
    try {
      p.loop = true;
      p.volume = this.loopVolumes[name] ?? 1;
      if (!p.playing) p.play();
    } catch {
      /* ignoré */
    }
  },
  pauseLoop(name: SoundName) {
    const p = this.players[name]?.[0];
    try {
      p?.pause();
    } catch {
      /* ignoré */
    }
  },
  stopLoop(name: SoundName) {
    this.loops.delete(name);
    const p = this.players[name]?.[0];
    try {
      p?.pause();
      if (p) swallow(p.seekTo(0));
    } catch {
      /* ignoré */
    }
  },
  pauseAll() {
    this.loops.forEach((l) => this.pauseLoop(l));
  },
  resumeAll() {
    this.loops.forEach((l) => this.resumeLoop(l));
  },
};

/* ════════════════════════════════════════════════════════════════════════
 * 8. GAME DESIGN : LIEUX, DIFFICULTÉ, BUTIN PROCÉDURAL
 * ════════════════════════════════════════════════════════════════════════ */

const TIERS: readonly Tier[] = [
  { name: 'Bijouterie Valmont', type: 'BIJOUTERIE', city: 'Genève', safe: 'Coffret Valmont V-200', mult: 1, accent: C.gold, fromLevel: 1 },
  { name: 'Banque Sterling & Fils', type: 'BANQUE', city: 'Zurich', safe: 'Chambre forte S-9', mult: 1.7, accent: '#7FB2FF', fromLevel: 3 },
  { name: 'Manoir Ravencourt', type: 'MANOIR', city: 'Cornouailles', safe: 'Coffre mural victorien', mult: 2.6, accent: '#C77DFF', fromLevel: 5 },
  { name: "Musée d'Orsenne", type: 'MUSÉE', city: 'Paris', safe: 'Réserve climatisée M-4', mult: 3.8, accent: '#5CFFB0', fromLevel: 7 },
  { name: 'Réserve Obsidienne', type: 'RÉSERVE FÉDÉRALE', city: '██████', safe: 'Caveau Obsidienne Ω', mult: 5.5, accent: C.red, fromLevel: 9 },
];

const tierForLevel = (level: number): Tier => {
  let t = TIERS[0];
  for (const tier of TIERS) if (level >= tier.fromLevel) t = tier;
  return t;
};

function getHeistConfig(level: number): HeistConfig {
  const L = Math.max(1, Math.floor(level));
  const tier = tierForLevel(L);
  const pins = clamp(1 + Math.floor((L - 1) / 2), 1, 5);
  const decoys = L < 3 ? 0 : clamp(Math.floor((L - 1) / 2), 1, L >= 11 ? 4 : 3);
  const timeLimitMs = L < 2 ? 0 : Math.round(clamp(30 + pins * 32 - Math.max(0, L - 9) * 6, 40, 200)) * 1000;
  const nearWindow = clamp(4.5 - (L - 1) * 0.15, 3, 4.5);
  const lockWindow = clamp(2.2 - (L - 1) * 0.12, 1.1, 2.2);
  const levelMult = 1 + (L - 1) * 0.35;
  return {
    level: L,
    tier,
    pins,
    decoys,
    timeLimitMs,
    lives: 3,
    nearWindow,
    lockWindow,
    holdMs: 1000,
    decoyTrapRatio: 0.7,
    lootMin: Math.round(40000 * tier.mult * levelMult),
    lootMax: Math.round(900000 * tier.mult * levelMult),
  };
}

const LOOT_BASES: readonly { kind: LootKind; noun: string; g: 'm' | 'f'; plural?: boolean; vowel?: boolean; base: number; hue: string }[] = [
  { kind: 'gem', noun: 'Diamant', g: 'm', base: 180000, hue: '#8FD8FF' },
  { kind: 'gem', noun: 'Saphir', g: 'm', base: 95000, hue: '#3D7BFF' },
  { kind: 'gem', noun: 'Émeraude', g: 'f', vowel: true, base: 120000, hue: '#2FE38A' },
  { kind: 'gem', noun: 'Rubis', g: 'm', base: 110000, hue: '#FF3B5C' },
  { kind: 'crown', noun: 'Couronne', g: 'f', base: 620000, hue: C.gold },
  { kind: 'crown', noun: 'Tiare', g: 'f', base: 330000, hue: '#E6E9F0' },
  { kind: 'necklace', noun: 'Collier', g: 'm', base: 160000, hue: '#F2E7D0' },
  { kind: 'painting', noun: 'Toile', g: 'f', base: 720000, hue: '#C9822F' },
  { kind: 'painting', noun: 'Portrait', g: 'm', base: 460000, hue: '#B5603A' },
  { kind: 'gold', noun: 'Lingots', g: 'm', plural: true, base: 260000, hue: C.gold },
  { kind: 'watch', noun: 'Montre à Gousset', g: 'f', base: 65000, hue: '#D9B36A' },
  { kind: 'statue', noun: 'Statuette', g: 'f', base: 230000, hue: '#5BD6C2' },
  { kind: 'egg', noun: 'Œuf Joaillier', g: 'm', vowel: true, base: 950000, hue: '#FF8FC8' },
  { kind: 'scroll', noun: 'Manuscrit', g: 'm', base: 145000, hue: '#E4D3A6' },
  { kind: 'scepter', noun: 'Sceptre', g: 'm', base: 540000, hue: C.gold },
  { kind: 'ring', noun: 'Chevalière', g: 'f', base: 48000, hue: '#FFCF6E' },
  { kind: 'vase', noun: 'Vase', g: 'm', base: 85000, hue: '#5E9BFF' },
];

const ADJECTIVES: readonly { m: string; f: string; mp: string }[] = [
  { m: 'Bleu', f: 'Bleue', mp: 'Bleus' },
  { m: 'Oublié', f: 'Oubliée', mp: 'Oubliés' },
  { m: 'Impérial', f: 'Impériale', mp: 'Impériaux' },
  { m: 'Maudit', f: 'Maudite', mp: 'Maudits' },
  { m: 'Noir', f: 'Noire', mp: 'Noirs' },
  { m: 'Sacré', f: 'Sacrée', mp: 'Sacrés' },
  { m: 'Éternel', f: 'Éternelle', mp: 'Éternels' },
  { m: 'Perdu', f: 'Perdue', mp: 'Perdus' },
  { m: 'Royal', f: 'Royale', mp: 'Royaux' },
  { m: 'Écarlate', f: 'Écarlate', mp: 'Écarlates' },
  { m: 'Silencieux', f: 'Silencieuse', mp: 'Silencieux' },
  { m: 'Pourpre', f: 'Pourpre', mp: 'Pourpres' },
  { m: 'Doré', f: 'Dorée', mp: 'Dorés' },
  { m: 'Englouti', f: 'Engloutie', mp: 'Engloutis' },
];

const ORIGINS: readonly string[] = [
  "d'Anvers",
  'des Médicis',
  'de Saint-Pétersbourg',
  'du Maharadjah',
  'de la Tsarine',
  'des Habsbourg',
  'du Pharaon',
  'de Monte-Carlo',
  'de Venise',
  'de Byzance',
  'des Templiers',
  'de Kyoto',
  "de l'Atlantide",
  'du Roi-Soleil',
  'de Carthagène',
  'du Dernier Shah',
  'de Samarcande',
  'de la Reine Rouge',
];

function rollRarity(level: number): Rarity {
  const r = Math.random();
  const leg = 0.02 + level * 0.012;
  const epi = 0.08 + level * 0.02;
  const rar = 0.25 + level * 0.02;
  if (r < leg) return 'legendaire';
  if (r < leg + epi) return 'epique';
  if (r < leg + epi + rar) return 'rare';
  return 'commun';
}

function generateLoot(cfg: HeistConfig, blind: boolean): LootItem {
  const base = pick(LOOT_BASES);
  const rarity = rollRarity(cfg.level);
  const useAdj = Math.random() < 0.85;
  const useOrigin = Math.random() < 0.9 || !useAdj;
  const adj = pick(ADJECTIVES);
  const article = base.plural ? 'Les' : base.vowel ? "L'" : base.g === 'm' ? 'Le' : 'La';
  const adjWord = base.plural ? adj.mp : base.g === 'm' ? adj.m : adj.f;
  const name = [article === "L'" ? `L'${base.noun}` : `${article} ${base.noun}`, useAdj ? adjWord : '', useOrigin ? pick(ORIGINS) : '']
    .filter(Boolean)
    .join(' ');
  const raw =
    base.base * RARITY_META[rarity].mult * cfg.tier.mult * (1 + (cfg.level - 1) * 0.35) * rand(0.75, 1.3) * (blind ? 1.5 : 1);
  const step = raw >= 1e6 ? 10000 : raw >= 1e5 ? 5000 : 1000;
  return {
    id: uid(),
    name,
    kind: base.kind,
    rarity,
    value: Math.max(step, Math.round(raw / step) * step),
    location: `${cfg.tier.name} — ${cfg.tier.city}`,
    level: cfg.level,
    date: Date.now(),
    hue: base.hue,
    blind,
  };
}

/* ════════════════════════════════════════════════════════════════════════
 * 9. MOTEUR DE CROCHETAGE (logique sensorielle de précision)
 * ════════════════════════════════════════════════════════════════════════ */

interface EngineConfig {
  pins: number;
  decoys: number;
  nearWindow: number;
  lockWindow: number;
  holdMs: number;
  decoyTrapRatio: number;
  sensitivity: number;
  autoRegenerate: boolean;
}

interface EngineCallbacks {
  onAnchor?: (decoy: boolean) => void;
  onHoldBroken?: (reason: 'moved' | 'tremble' | 'released') => void;
  onPinUnlocked?: (pinIndex: number) => void;
  onAllUnlocked?: () => void;
  onTrap?: () => void;
  onZonesChanged?: (zones: Zone[]) => void;
}

const DETENT_DEG = 2;
const MAX_HOLD_VELOCITY = 42; // degrés de cadran par seconde
const SENSITIVITY_VALUES = [0.38, 0.6, 0.9];

class LockEngine {
  cfg: EngineConfig;
  cb: EngineCallbacks = {};
  active = false;
  size = 300;

  dialAnim = new Animated.Value(0);
  holdAnim = new Animated.Value(0);
  glowAnim = new Animated.Value(0);

  rotation = 0;
  reading = 0;
  lastAngle: number | null = null;
  touching = false;
  lastMoveT = 0;
  velocity = 0;
  lastDetent = 0;
  lastTickSound = 0;
  cumulative = 0;

  zones: Zone[] = [];
  zoneSeq = 1;
  inZone: Zone | null = null;
  holdStart = 0;
  holdProgress = 0;
  nearestDist = 999;
  nearestKind: ZoneKind | null = null;
  lastTremor = 0;
  cooldownUntil = 0;
  pinIndex = 0;
  cx = 0;
  cy = 0;
  glow = 0;
  raf: number | null = null;
  pan: PanResponderInstance;

  constructor(cfg: EngineConfig) {
    this.cfg = cfg;
    this.pan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        const { pageX, pageY, locationX, locationY } = e.nativeEvent;
        // Centre absolu du cadran déduit de la position relative initiale (fiable sur iOS & Android).
        this.cx = pageX - locationX + this.size / 2;
        this.cy = pageY - locationY + this.size / 2;
        this.touching = true;
        this.lastMoveT = Date.now();
        this.velocity = 0;
        this.lastAngle = this.angleAt(pageX, pageY);
        if (this.inZone) this.holdStart = Date.now();
      },
      onPanResponderMove: (e) => this.handleMove(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease: () => this.release(),
      onPanResponderTerminate: () => this.release(),
    });
  }

  angleAt(x: number, y: number): number | null {
    const dx = x - this.cx;
    const dy = y - this.cy;
    if (Math.hypot(dx, dy) < this.size * 0.11) return null; // zone morte centrale : atan2 instable
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  handleMove(x: number, y: number) {
    if (!this.active) return;
    const a = this.angleAt(x, y);
    if (a == null) {
      this.lastAngle = null;
      return;
    }
    if (this.lastAngle == null) {
      this.lastAngle = a;
      return;
    }
    let d = a - this.lastAngle;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    this.lastAngle = a;
    const delta = d * this.cfg.sensitivity;
    const now = Date.now();
    const dt = Math.max(4, now - this.lastMoveT);
    this.lastMoveT = now;
    const inst = (Math.abs(delta) / dt) * 1000;
    this.velocity = this.velocity * 0.78 + inst * 0.22;

    this.rotation += delta;
    this.cumulative += Math.abs(delta);
    this.reading = mod(-this.rotation, 360);
    this.dialAnim.setValue(this.rotation);

    const detent = Math.floor(this.rotation / DETENT_DEG);
    if (detent !== this.lastDetent) {
      this.lastDetent = detent;
      HapticEngine.tick();
      if (now - this.lastTickSound > 32) {
        this.lastTickSound = now;
        SoundEngine.play('tick', 0.28);
      }
    }
    this.evaluate(now);
  }

  release() {
    this.touching = false;
    this.lastAngle = null;
    if (this.inZone && this.holdProgress > 0.05) this.breakHold('released');
  }

  evaluate(now: number) {
    if (now < this.cooldownUntil) {
      this.nearestDist = 999;
      this.nearestKind = null;
      return;
    }
    let best: Zone | null = null;
    let bestDist = 999;
    for (const z of this.zones) {
      const dd = circDist(this.reading, z.angle);
      if (dd < bestDist) {
        bestDist = dd;
        best = z;
      }
    }
    this.nearestDist = bestDist;
    this.nearestKind = best ? best.kind : null;
    const inLock = !!best && bestDist <= this.cfg.lockWindow;
    if (inLock && best && this.inZone?.id !== best.id) {
      this.inZone = best;
      this.holdStart = now;
      this.holdProgress = 0;
      if (best.kind === 'target') {
        HapticEngine.anchor();
        SoundEngine.play('anchor', 0.75);
      } else {
        HapticEngine.decoy();
        SoundEngine.play('decoy', 0.75);
      }
      this.cb.onAnchor?.(best.kind === 'decoy');
    } else if (!inLock && this.inZone) {
      if (this.holdProgress > 0.08) this.breakHold('moved');
      this.inZone = null;
    }
  }

  breakHold(reason: 'moved' | 'tremble' | 'released') {
    this.holdProgress = 0;
    this.holdStart = Date.now();
    this.holdAnim.setValue(0);
    HapticEngine.holdBroken();
    SoundEngine.play('reset', 0.5);
    this.cb.onHoldBroken?.(reason);
  }

  frame = () => {
    const now = Date.now();
    if (this.active) {
      if (now - this.lastMoveT > 45) this.velocity *= 0.82;

      if (this.inZone && this.touching) {
        if (this.velocity > MAX_HOLD_VELOCITY) {
          if (this.holdProgress > 0.1) this.breakHold('tremble');
          else this.holdStart = now;
        }
        this.holdProgress = clamp((now - this.holdStart) / this.cfg.holdMs, 0, 1);
        this.holdAnim.setValue(this.holdProgress);
        if (this.inZone.kind === 'decoy' && this.holdProgress >= this.cfg.decoyTrapRatio) this.trap(now);
        else if (this.inZone.kind === 'target' && this.holdProgress >= 1) this.unlockPin(now);
      } else if (this.holdProgress > 0) {
        this.holdProgress = Math.max(0, this.holdProgress - 0.08);
        this.holdAnim.setValue(this.holdProgress);
      }

      if (this.touching && !this.inZone && this.nearestDist <= this.cfg.nearWindow && now >= this.cooldownUntil) {
        const span = Math.max(0.5, this.cfg.nearWindow - this.cfg.lockWindow);
        const closeness = clamp(1 - (this.nearestDist - this.cfg.lockWindow) / span, 0, 1);
        const interval = lerp(190, 55, closeness);
        if (now - this.lastTremor > interval) {
          this.lastTremor = now;
          HapticEngine.tremor(closeness);
        }
      }

      const targetGlow = this.inZone ? 1 : 0;
      if (Math.abs(this.glow - targetGlow) > 0.01) {
        this.glow = lerp(this.glow, targetGlow, 0.25);
        this.glowAnim.setValue(this.glow);
      }
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  unlockPin(now: number) {
    this.inZone = null;
    this.holdProgress = 0;
    this.holdAnim.setValue(0);
    HapticEngine.unlock();
    SoundEngine.play('unlock', 0.9);
    const idx = this.pinIndex;
    this.pinIndex += 1;
    this.cooldownUntil = now + 500;
    this.cb.onPinUnlocked?.(idx);
    if (this.pinIndex >= this.cfg.pins) {
      this.zones = [];
      this.cb.onZonesChanged?.(this.zones);
      this.cb.onAllUnlocked?.();
    } else if (this.cfg.autoRegenerate) {
      this.regenerate();
    }
  }

  trap(now: number) {
    const z = this.inZone;
    this.inZone = null;
    this.holdProgress = 0;
    this.holdAnim.setValue(0);
    this.cooldownUntil = now + 900;
    HapticEngine.error();
    SoundEngine.play('error', 0.85);
    if (z) {
      this.zones = this.zones.map((zz) => (zz.id === z.id ? { ...zz, id: this.zoneSeq++, angle: this.freeAngle(this.zones, zz.id) } : zz));
      this.cb.onZonesChanged?.(this.zones);
    }
    this.cb.onTrap?.();
  }

  freeAngle(existing: Zone[], ignoreId = -1): number {
    for (let tries = 0; tries < 200; tries++) {
      const a = Math.round(rand(0, 359));
      const okReading = circDist(a, this.reading) > 40;
      const okOthers = existing.every((z) => z.id === ignoreId || circDist(a, z.angle) > 26);
      if (okReading && okOthers) return a;
    }
    return mod(this.reading + 180, 360);
  }

  regenerate() {
    const zones: Zone[] = [];
    zones.push({ id: this.zoneSeq++, angle: this.freeAngle(zones), kind: 'target' });
    for (let i = 0; i < this.cfg.decoys; i++) zones.push({ id: this.zoneSeq++, angle: this.freeAngle(zones), kind: 'decoy' });
    this.zones = zones;
    this.inZone = null;
    this.cb.onZonesChanged?.(zones);
  }

  setZones(spec: { angle: number; kind: ZoneKind }[]) {
    this.zones = spec.map((s) => ({ id: this.zoneSeq++, angle: mod(Math.round(s.angle), 360), kind: s.kind }));
    this.inZone = null;
    this.holdProgress = 0;
    this.holdAnim.setValue(0);
    this.cb.onZonesChanged?.(this.zones);
  }

  reset() {
    this.pinIndex = 0;
    this.inZone = null;
    this.holdProgress = 0;
    this.holdAnim.setValue(0);
    this.cumulative = 0;
    this.cooldownUntil = 0;
  }

  start() {
    if (this.raf == null) this.raf = requestAnimationFrame(this.frame);
  }
  stop() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }
}

function useLockEngine(cfg: EngineConfig, cb: EngineCallbacks, active: boolean, size: number) {
  const ref = useRef<LockEngine | null>(null);
  if (!ref.current) ref.current = new LockEngine(cfg);
  const engine = ref.current;
  engine.cfg = cfg;
  engine.cb = cb;
  engine.active = active;
  engine.size = size;
  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);
  return engine;
}

/* ════════════════════════════════════════════════════════════════════════
 * 10. PRIMITIVES VISUELLES : FOND MÉTAL, HUD CCTV, BOUTONS, ICÔNES
 * ════════════════════════════════════════════════════════════════════════ */

const MetalBackdrop = memo(function MetalBackdrop({ tint = C.gold, scanlines = true }: { tint?: string; scanlines?: boolean }) {
  const { width, height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#07080B', '#020203', '#08090C', '#000000']} locations={[0, 0.35, 0.7, 1]} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="brushed" patternUnits="userSpaceOnUse" width={6} height={6}>
            <Line x1={0} y1={6} x2={6} y2={0} stroke="#FFFFFF" strokeOpacity={0.018} strokeWidth={1} />
          </Pattern>
          <Pattern id="scan" patternUnits="userSpaceOnUse" width={4} height={3}>
            <Rect x={0} y={0} width={4} height={1} fill="#000000" fillOpacity={0.35} />
          </Pattern>
          <RadialGradient id="vignette" cx="50%" cy="45%" rx="75%" ry="65%">
            <Stop offset="0.55" stopColor="#000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.85} />
          </RadialGradient>
          <RadialGradient id="tintGlow" cx="50%" cy="0%" rx="70%" ry="45%">
            <Stop offset="0" stopColor={tint} stopOpacity={0.13} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="boltG" cx="35%" cy="35%" r="70%">
            <Stop offset="0" stopColor={C.steelHi} />
            <Stop offset="0.6" stopColor={C.steelMid} />
            <Stop offset="1" stopColor="#14171C" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#brushed)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#tintGlow)" />
        {/* Joints de plaques métalliques */}
        <Line x1={0} y1={height * 0.33} x2={width} y2={height * 0.33} stroke="#FFFFFF" strokeOpacity={0.035} />
        <Line x1={0} y1={height * 0.33 + 1} x2={width} y2={height * 0.33 + 1} stroke="#000" strokeOpacity={0.6} />
        <Line x1={0} y1={height * 0.78} x2={width} y2={height * 0.78} stroke="#FFFFFF" strokeOpacity={0.035} />
        <Line x1={0} y1={height * 0.78 + 1} x2={width} y2={height * 0.78 + 1} stroke="#000" strokeOpacity={0.6} />
        {[
          [14, height * 0.33 - 12],
          [width - 14, height * 0.33 - 12],
          [14, height * 0.33 + 12],
          [width - 14, height * 0.33 + 12],
          [14, height * 0.78 + 12],
          [width - 14, height * 0.78 + 12],
        ].map(([x, y], i) => (
          <G key={i}>
            <Circle cx={x} cy={y} r={4.2} fill="url(#boltG)" opacity={0.55} />
            <Line x1={x - 2.6} y1={y - 1.2} x2={x + 2.6} y2={y + 1.2} stroke="#0A0B0E" strokeWidth={1} opacity={0.7} />
          </G>
        ))}
        {scanlines ? <Rect x={0} y={0} width={width} height={height} fill="url(#scan)" opacity={0.45} /> : null}
        <Rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />
      </Svg>
    </View>
  );
});

function useBlink(period = 900, enabled = true) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!enabled) {
      v.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.15, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, period, enabled]);
  return v;
}

function CctvHud({ cam, label }: { cam: string; label: string }) {
  const blink = useBlink(1100);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const d = new Date(now);
  const p = (x: number) => x.toString().padStart(2, '0');
  return (
    <View style={styles.cctv}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Animated.View style={[styles.recDot, { opacity: blink }]} />
        <Text style={styles.cctvText}>REC {cam}</Text>
      </View>
      <Text style={styles.cctvTextDim}>
        {p(d.getHours())}:{p(d.getMinutes())}:{p(d.getSeconds())} · {label}
      </Text>
    </View>
  );
}

type ButtonVariant = 'gold' | 'steel' | 'red' | 'ghost' | 'cctv';

const BUTTON_GRADIENTS: Record<ButtonVariant, readonly [string, string, string]> = {
  gold: ['#FFE6A8', '#E8B04B', '#8A5B14'],
  steel: ['#3B434F', '#1C2128', '#0E1115'],
  red: ['#FF6672', '#D11F2F', '#5E0710'],
  ghost: ['#0E1014', '#0B0D11', '#08090C'],
  cctv: ['#0F3A28', '#0A2619', '#061810'],
};

function HeistButton({
  label,
  sub,
  onPress,
  variant = 'steel',
  icon,
  style,
  compact,
  disabled,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  style?: object;
  compact?: boolean;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const dark = variant === 'gold';
  const textColor = dark ? '#1A1206' : variant === 'cctv' ? C.cctv : variant === 'ghost' ? C.textDim : C.text;
  const border = variant === 'gold' ? C.goldHi : variant === 'red' ? C.redHi : variant === 'cctv' ? C.cctvDim : C.lineHi;
  return (
    <Animated.View style={[{ transform: [{ scale }], opacity: disabled ? 0.45 : 1 }, style]}>
      <Pressable
        disabled={disabled}
        onPressIn={() => Animated.spring(scale, { toValue: 0.965, useNativeDriver: true, speed: 40, bounciness: 0 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start()}
        onPress={() => {
          HapticEngine.ui();
          SoundEngine.play('ui', 0.6);
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <LinearGradient
          colors={BUTTON_GRADIENTS[variant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.2, y: 1 }}
          style={[styles.btn, compact && styles.btnCompact, { borderColor: border }]}
        >
          <View style={[styles.btnSheen, dark && { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
          {icon ? <View style={styles.btnIcon}>{icon}</View> : null}
          <View style={{ flex: icon ? 1 : 0, alignItems: icon ? 'flex-start' : 'center' }}>
            <Text style={[styles.btnLabel, compact && { fontSize: 14 }, { color: textColor }]}>{label}</Text>
            {sub ? <Text style={[styles.btnSub, { color: dark ? '#4A3510' : C.textMute }]}>{sub}</Text> : null}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/** Jeu d'icônes vectorielles maison. */
function Icon({ name, size = 22, color = C.gold }: { name: string; size?: number; color?: string }) {
  const s = size;
  const sw = 1.8;
  switch (name) {
    case 'dial':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={9.5} stroke={color} strokeWidth={sw} fill="none" />
          <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={sw} fill="none" />
          <Path d="M12 2.5 L12 6 M21.5 12 L18 12 M12 21.5 L12 18 M2.5 12 L6 12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'vault':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Rect x={2.5} y={3.5} width={19} height={16} rx={2} stroke={color} strokeWidth={sw} fill="none" />
          <Circle cx={12} cy={11.5} r={4.5} stroke={color} strokeWidth={sw} fill="none" />
          <Path d="M12 7 L12 9 M12 14 L12 16 M7.5 11.5 L9.5 11.5 M14.5 11.5 L16.5 11.5 M6 19.5 L6 21.5 M18 19.5 L18 21.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'finger':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path d="M6.5 18 C5 15.5 5 13 5 11 C5 7 8 4 12 4 C16 4 19 7 19 11" stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" />
          <Path d="M9 19.5 C8 17.5 8 15 8 12 C8 9.5 9.8 7.5 12 7.5 C14.2 7.5 16 9.5 16 12 C16 14 16 15.5 15.5 17" stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" />
          <Path d="M12 11 C12 14 12 17 13 20" stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" />
        </Svg>
      );
    case 'gear':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path d={gearPath(12, 12, 9.5, 7, 8)} stroke={color} strokeWidth={sw * 0.9} fill="none" strokeLinejoin="round" />
          <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={sw} fill="none" />
        </Svg>
      );
    case 'play':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path d="M7 4.5 L19 12 L7 19.5 Z" fill={color} />
        </Svg>
      );
    case 'pause':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Rect x={6} y={4.5} width={4} height={15} rx={1} fill={color} />
          <Rect x={14} y={4.5} width={4} height={15} rx={1} fill={color} />
        </Svg>
      );
    case 'back':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path d="M15 5 L8 12 L15 19" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'wave':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path d="M2 12 L5 12 L7 6 L10 18 L13 4 L16 20 L18 9 L20 12 L22 12" stroke={color} strokeWidth={sw} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      );
    case 'coin':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Ellipse cx={12} cy={8} rx={8} ry={3.5} stroke={color} strokeWidth={sw} fill="none" />
          <Path d="M4 8 L4 16 C4 18 7.6 19.5 12 19.5 C16.4 19.5 20 18 20 16 L20 8 M4 12 C4 14 7.6 15.5 12 15.5 C16.4 15.5 20 14 20 12" stroke={color} strokeWidth={sw} fill="none" />
        </Svg>
      );
    case 'lock':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Rect x={4.5} y={10.5} width={15} height={10} rx={2} stroke={color} strokeWidth={sw} fill="none" />
          <Path d="M8 10.5 L8 7.5 C8 5.3 9.8 3.5 12 3.5 C14.2 3.5 16 5.3 16 7.5 L16 10.5" stroke={color} strokeWidth={sw} fill="none" />
          <Circle cx={12} cy={15.5} r={1.6} fill={color} />
        </Svg>
      );
    case 'eye':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path d="M2 12 C5 6.5 8.5 4.5 12 4.5 C15.5 4.5 19 6.5 22 12 C19 17.5 15.5 19.5 12 19.5 C8.5 19.5 5 17.5 2 12 Z" stroke={color} strokeWidth={sw} fill="none" />
          <Circle cx={12} cy={12} r={3.5} stroke={color} strokeWidth={sw} fill="none" />
        </Svg>
      );
    case 'siren':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path d="M6 18 L6 12 C6 8.7 8.7 6 12 6 C15.3 6 18 8.7 18 12 L18 18 Z" stroke={color} strokeWidth={sw} fill="none" />
          <Path d="M4 20.5 L20 20.5 M12 2 L12 3.5 M4.5 5 L5.5 6 M19.5 5 L18.5 6" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    default:
      return null;
  }
}

/** Génère le tracé d'un engrenage. */
function gearPath(cx: number, cy: number, rOuter: number, rInner: number, teeth: number) {
  const pts: string[] = [];
  const step = 360 / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const p1 = polar(cx, cy, rInner, a - step * 0.5);
    const p2 = polar(cx, cy, rInner, a - step * 0.22);
    const p3 = polar(cx, cy, rOuter, a - step * 0.14);
    const p4 = polar(cx, cy, rOuter, a + step * 0.14);
    const p5 = polar(cx, cy, rInner, a + step * 0.22);
    pts.push(`${i === 0 ? 'M' : 'L'}${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`);
    pts.push(`L${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L${p3.x.toFixed(2)} ${p3.y.toFixed(2)} L${p4.x.toFixed(2)} ${p4.y.toFixed(2)} L${p5.x.toFixed(2)} ${p5.y.toFixed(2)}`);
  }
  return pts.join(' ') + ' Z';
}

/* ════════════════════════════════════════════════════════════════════════
 * 11. LOGO OFFICIEL ANIMÉ + ICÔNE D'APPLICATION
 * ════════════════════════════════════════════════════════════════════════ */

/** Arcs d'empreinte digitale procéduraux (spirale elliptique interrompue). */
function fingerprintPaths(cx: number, cy: number, rings: number, step: number): string[] {
  const out: string[] = [];
  const rnd = mulberry32(2024);
  for (let i = 0; i < rings; i++) {
    const rx = 4 + i * step;
    const ry = 5.5 + i * step * 1.12;
    const segs = i < 2 ? 1 : 2 + (i % 2);
    const gapStart = rnd() * 360;
    const span = 360 / segs;
    for (let s = 0; s < segs; s++) {
      const from = gapStart + s * span + 8 + rnd() * 10;
      const to = gapStart + (s + 1) * span - 8 - rnd() * 10;
      if (i >= rings - 2 && s === segs - 1) continue; // bord inférieur ouvert, comme une vraie empreinte
      let d = '';
      for (let a = from; a <= to; a += 6) {
        const rad = (a * Math.PI) / 180;
        const wob = 1 + 0.04 * Math.sin(rad * 3 + i);
        const x = cx + rx * wob * Math.sin(rad);
        const y = cy - ry * wob * Math.cos(rad) + i * 0.25;
        d += `${d ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
      }
      if (d) out.push(d);
    }
  }
  return out;
}

const LogoMark = memo(function LogoMark({ size, glow = true }: { size: number; glow?: boolean }) {
  const prints = useMemo(() => fingerprintPaths(100, 100, 9, 4.6), []);
  const ticks = useMemo(() => {
    let d = '';
    for (let i = 0; i < 60; i++) {
      const a = i * 6;
      const r1 = i % 5 === 0 ? 70 : 74;
      const p1 = polar(100, 100, r1, a);
      const p2 = polar(100, 100, 79, a);
      d += `M${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L${p2.x.toFixed(2)} ${p2.y.toFixed(2)} `;
    }
    return d;
  }, []);
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id="lmGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={C.gold} stopOpacity={0.35} />
          <Stop offset="1" stopColor={C.gold} stopOpacity={0} />
        </RadialGradient>
        <SvgLinearGradient id="lmGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={C.goldHi} />
          <Stop offset="0.45" stopColor={C.gold} />
          <Stop offset="0.75" stopColor={C.goldDeep} />
          <Stop offset="1" stopColor={C.goldMid} />
        </SvgLinearGradient>
        <SvgLinearGradient id="lmSteel" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4A5260" />
          <Stop offset="0.5" stopColor="#1A1E25" />
          <Stop offset="1" stopColor="#30363F" />
        </SvgLinearGradient>
        <RadialGradient id="lmFace" cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#262B33" />
          <Stop offset="1" stopColor="#07080A" />
        </RadialGradient>
      </Defs>
      {glow ? <Circle cx={100} cy={100} r={100} fill="url(#lmGlow)" /> : null}
      <Circle cx={100} cy={100} r={88} fill="url(#lmSteel)" />
      <Circle cx={100} cy={100} r={86} fill="none" stroke="url(#lmGold)" strokeWidth={3} />
      {Array.from({ length: 8 }).map((_, i) => {
        const p = polar(100, 100, 83, i * 45 + 22.5);
        return <Circle key={i} cx={p.x} cy={p.y} r={2.3} fill={C.steel} stroke="#0A0B0D" strokeWidth={0.6} />;
      })}
      <Circle cx={100} cy={100} r={80} fill="url(#lmFace)" />
      <Path d={ticks} stroke="url(#lmGold)" strokeWidth={1.6} strokeLinecap="round" />
      <Circle cx={100} cy={100} r={64} fill="none" stroke="url(#lmGold)" strokeWidth={1.2} strokeOpacity={0.6} />
      {prints.map((d, i) => (
        <Path key={i} d={d} stroke="url(#lmGold)" strokeWidth={2.1} fill="none" strokeLinecap="round" opacity={0.95} />
      ))}
      <Polygon points="100,12 94,2 106,2" fill={C.red} />
      <Path d="M100 14 L100 24" stroke={C.red} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
});

function AppIcon({ size = 72 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.225, overflow: 'hidden', borderWidth: 1, borderColor: C.lineHi }}>
      <LinearGradient colors={['#1D2129', '#050608']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: size * 0.45, backgroundColor: 'rgba(255,255,255,0.04)' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <LogoMark size={size * 0.84} glow={false} />
      </View>
    </View>
  );
}

function HeistLogo({ size = 210 }: { size?: number }) {
  const intro = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const crack = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const waves = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.spring(intro, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
    const p = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const c = Animated.loop(
      Animated.sequence([
        Animated.timing(crack, { toValue: -0.09, duration: 1600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(250),
        Animated.timing(crack, { toValue: 0.12, duration: 1900, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(250),
        Animated.timing(crack, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(700),
      ]),
    );
    const s = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scan, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const w = waves.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 700),
          Animated.timing(v, { toValue: 1, duration: 2100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    p.start();
    c.start();
    s.start();
    w.forEach((x) => x.start());
    return () => {
      p.stop();
      c.stop();
      s.stop();
      w.forEach((x) => x.stop());
    };
  }, [intro, pulse, crack, scan, waves]);

  const titleScale = Animated.multiply(
    intro.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }),
  );
  const markSize = size * 0.72;
  const titleW = Math.min(size * 1.6, 360);

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {waves.map((v, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: markSize,
              height: markSize,
              borderRadius: markSize / 2,
              borderWidth: 1.5,
              borderColor: i === 1 ? C.cctv : C.gold,
              opacity: v.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.55, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.42] }) }],
            }}
          />
        ))}
        <Animated.View
          style={{
            transform: [
              { scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
              { rotate: crack.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] }) },
            ],
            opacity: intro,
          }}
        >
          <LogoMark size={markSize} />
        </Animated.View>
        <View
          pointerEvents="none"
          style={{ position: 'absolute', width: markSize * 0.66, height: markSize * 0.66, borderRadius: markSize * 0.33, overflow: 'hidden' }}
        >
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: C.cctv,
              opacity: 0.75,
              shadowColor: C.cctv,
              shadowOpacity: 1,
              shadowRadius: 6,
              transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [0, markSize * 0.66] }) }],
            }}
          />
        </View>
        {/* Ondes haptiques latérales */}
        <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
          {[0, 1, 2].map((i) => {
            const r = markSize / 2 + 8 + i * 9;
            const c = size / 2;
            const a1 = polar(c, c, r, 62);
            const a2 = polar(c, c, r, 118);
            const b1 = polar(c, c, r, 242);
            const b2 = polar(c, c, r, 298);
            return (
              <G key={i} opacity={0.75 - i * 0.22}>
                <Path d={`M${a1.x} ${a1.y} A${r} ${r} 0 0 1 ${a2.x} ${a2.y}`} stroke={C.gold} strokeWidth={2} fill="none" strokeLinecap="round" />
                <Path d={`M${b1.x} ${b1.y} A${r} ${r} 0 0 1 ${b2.x} ${b2.y}`} stroke={C.gold} strokeWidth={2} fill="none" strokeLinecap="round" />
              </G>
            );
          })}
        </Svg>
      </View>
      <Animated.View style={{ transform: [{ scale: titleScale }], opacity: intro, marginTop: -6 }}>
        <Svg width={titleW} height={titleW * 0.32} viewBox="0 0 360 115">
          <Defs>
            <SvgLinearGradient id="tSteel" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="0.48" stopColor="#AEB6C2" />
              <Stop offset="0.52" stopColor="#6B7482" />
              <Stop offset="1" stopColor="#D8DEE6" />
            </SvgLinearGradient>
            <SvgLinearGradient id="tGold" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFF3CF" />
              <Stop offset="0.45" stopColor={C.gold} />
              <Stop offset="0.55" stopColor={C.goldDeep} />
              <Stop offset="1" stopColor={C.goldHi} />
            </SvgLinearGradient>
          </Defs>
          <SvgText x={180} y={46} fontSize={44} fontWeight="900" fontFamily={DISPLAY} letterSpacing={10} textAnchor="middle" fill="url(#tSteel)" stroke="#000" strokeWidth={0.8}>
            HAPTIC
          </SvgText>
          <SvgText x={180} y={98} fontSize={58} fontWeight="900" fontFamily={DISPLAY} letterSpacing={14} textAnchor="middle" fill="url(#tGold)" stroke="#2A1A04" strokeWidth={1}>
            HEIST
          </SvgText>
          <Line x1={20} y1={108} x2={120} y2={108} stroke={C.gold} strokeOpacity={0.5} />
          <Line x1={240} y1={108} x2={340} y2={108} stroke={C.gold} strokeOpacity={0.5} />
        </Svg>
      </Animated.View>
      <Text style={styles.logoTagline}>CASSE SENSORIEL · 100 % HORS LIGNE</Text>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 12. LE CADRAN SKEUOMORPHIQUE
 * ════════════════════════════════════════════════════════════════════════ */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DialFace = memo(function DialFace({ size, accent }: { size: number; accent: string }) {
  const c = size / 2;
  const R = size * 0.4;
  const { ticks, knurl, labels } = useMemo(() => {
    let t = '';
    for (let i = 0; i < 180; i++) {
      const a = i * DETENT_DEG;
      const major = a % 30 === 0;
      const mid = a % 10 === 0;
      const r1 = R * (major ? 0.8 : mid ? 0.85 : 0.89);
      const p1 = polar(c, c, r1, a);
      const p2 = polar(c, c, R * 0.93, a);
      t += `M${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L${p2.x.toFixed(2)} ${p2.y.toFixed(2)} `;
    }
    let k = '';
    for (let i = 0; i < 120; i++) {
      const a = i * 3;
      const p1 = polar(c, c, R * 0.965, a);
      const p2 = polar(c, c, R * 1.02, a);
      k += `M${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L${p2.x.toFixed(2)} ${p2.y.toFixed(2)} `;
    }
    const l = Array.from({ length: 12 }, (_, i) => {
      const a = i * 30;
      const p = polar(c, c, R * 0.69, a);
      return { a, x: p.x, y: p.y };
    });
    return { ticks: t, knurl: k, labels: l };
  }, [c, R]);
  const grips = Array.from({ length: 10 }, (_, i) => i * 36);
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="dfFace" cx="42%" cy="35%" r="75%">
          <Stop offset="0" stopColor="#3A414C" />
          <Stop offset="0.55" stopColor="#171A20" />
          <Stop offset="1" stopColor="#08090B" />
        </RadialGradient>
        <SvgLinearGradient id="dfKnurl" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E3E8EF" />
          <Stop offset="0.5" stopColor="#59616E" />
          <Stop offset="1" stopColor="#A9B1BC" />
        </SvgLinearGradient>
        <SvgLinearGradient id="dfGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={C.goldHi} />
          <Stop offset="0.5" stopColor={C.gold} />
          <Stop offset="1" stopColor={C.goldDeep} />
        </SvgLinearGradient>
        <RadialGradient id="dfKnob" cx="38%" cy="30%" r="80%">
          <Stop offset="0" stopColor="#F2F4F7" />
          <Stop offset="0.35" stopColor="#9AA2AE" />
          <Stop offset="0.8" stopColor="#3B424D" />
          <Stop offset="1" stopColor="#1B1F25" />
        </RadialGradient>
        <SvgLinearGradient id="dfHandle" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#2A2F37" />
          <Stop offset="0.5" stopColor="#C7CDD6" />
          <Stop offset="1" stopColor="#2A2F37" />
        </SvgLinearGradient>
      </Defs>
      <Circle cx={c} cy={c} r={R * 1.03} fill="#050506" />
      <Path d={knurl} stroke="url(#dfKnurl)" strokeWidth={2.2} />
      <Circle cx={c} cy={c} r={R * 0.96} fill="url(#dfFace)" stroke="#000" strokeWidth={1.5} />
      <Path d={ticks} stroke={C.steelHi} strokeOpacity={0.8} strokeWidth={1.2} strokeLinecap="round" />
      {labels.map((l) => (
        <SvgText
          key={l.a}
          x={l.x}
          y={l.y + size * 0.016}
          fontSize={size * 0.045}
          fontWeight="700"
          fill={l.a === 0 ? accent : C.steelHi}
          textAnchor="middle"
          fontFamily={MONO}
          rotation={l.a}
          origin={`${l.x}, ${l.y}`}
        >
          {l.a.toString()}
        </SvgText>
      ))}
      <Circle cx={c} cy={c} r={R * 0.56} fill="none" stroke="url(#dfGold)" strokeWidth={2} />
      <Circle cx={c} cy={c} r={R * 0.5} fill="url(#dfKnob)" stroke="#0B0C0F" strokeWidth={1.5} />
      {grips.map((a) => {
        const p = polar(c, c, R * 0.42, a);
        return <Circle key={a} cx={p.x} cy={p.y} r={R * 0.05} fill="#20242B" stroke="#ffffff" strokeOpacity={0.2} strokeWidth={0.8} />;
      })}
      <Rect x={c - R * 0.09} y={c - R * 0.36} width={R * 0.18} height={R * 0.72} rx={R * 0.06} fill="url(#dfHandle)" stroke="#0A0B0E" strokeWidth={1} />
      <Circle cx={c} cy={c} r={R * 0.07} fill="url(#dfGold)" />
      <Path d={`M${c} ${c - R * 0.33} L${c} ${c - R * 0.2}`} stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
});

const DialBezel = memo(function DialBezel({ size }: { size: number }) {
  const c = size / 2;
  const bolts = Array.from({ length: 12 }, (_, i) => polar(c, c, size * 0.475, i * 30 + 15));
  return (
    <Svg width={size} height={size}>
      <Defs>
        <SvgLinearGradient id="bzSteel" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5D6573" />
          <Stop offset="0.3" stopColor="#1E2229" />
          <Stop offset="0.55" stopColor="#4B525E" />
          <Stop offset="0.8" stopColor="#14171B" />
          <Stop offset="1" stopColor="#3C434E" />
        </SvgLinearGradient>
        <RadialGradient id="bzInner" cx="50%" cy="50%" r="50%">
          <Stop offset="0.82" stopColor="#000" />
          <Stop offset="1" stopColor="#14171C" />
        </RadialGradient>
        <RadialGradient id="bzBolt" cx="35%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#EEF1F5" />
          <Stop offset="0.6" stopColor="#6A7280" />
          <Stop offset="1" stopColor="#15181D" />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={size * 0.5} fill="url(#bzSteel)" />
      <Circle cx={c} cy={c} r={size * 0.495} fill="none" stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={1} />
      <Circle cx={c} cy={c} r={size * 0.455} fill="url(#bzInner)" />
      <Circle cx={c} cy={c} r={size * 0.445} fill="none" stroke="#2A2F38" strokeWidth={size * 0.012} />
      {bolts.map((b, i) => (
        <G key={i}>
          <Circle cx={b.x} cy={b.y} r={size * 0.014} fill="url(#bzBolt)" stroke="#07080A" strokeWidth={0.8} />
          <Line x1={b.x - size * 0.009} y1={b.y} x2={b.x + size * 0.009} y2={b.y} stroke="#0B0C0F" strokeWidth={1.1} />
        </G>
      ))}
    </Svg>
  );
});

const GearWindow = memo(function GearWindow({ size, rotate, color }: { size: number; rotate: Animated.AnimatedInterpolation<string>; color: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#050506', borderWidth: 1.5, borderColor: '#3A414C' }}>
      <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
        <Svg width={size} height={size} viewBox="0 0 40 40">
          <Path d={gearPath(20, 20, 19, 15, 12)} fill={color} fillOpacity={0.85} stroke="#000" strokeWidth={0.6} />
          <Circle cx={20} cy={20} r={6} fill="#0B0C0F" />
          <Circle cx={20} cy={20} r={2.5} fill={color} />
        </Svg>
      </Animated.View>
      <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
    </View>
  );
});

function LockDial({
  size,
  engine,
  accent,
  markers,
}: {
  size: number;
  engine: LockEngine;
  accent: string;
  markers: Zone[] | null;
}) {
  const faceSize = size * 0.9;
  const faceOffset = (size - faceSize) / 2;
  const rotate = useMemo(
    () => engine.dialAnim.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'], extrapolate: 'extend' }),
    [engine],
  );
  const gearRotA = useMemo(
    () => engine.dialAnim.interpolate({ inputRange: [-360, 360], outputRange: ['1080deg', '-1080deg'], extrapolate: 'extend' }),
    [engine],
  );
  const gearRotB = useMemo(
    () => engine.dialAnim.interpolate({ inputRange: [-360, 360], outputRange: ['-720deg', '720deg'], extrapolate: 'extend' }),
    [engine],
  );
  const holdR = size * 0.465;
  const circ = TAU * holdR;
  const dashOffset = useMemo(() => engine.holdAnim.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] }), [engine, circ]);
  const gearSize = size * 0.13;

  return (
    <View style={{ width: size, height: size }}>
      <DialBezel size={size} />
      {/* Fentes d'engrenages animées (tournent avec le mécanisme) */}
      <View style={{ position: 'absolute', left: size * 0.035, top: size * 0.82 }} pointerEvents="none">
        <GearWindow size={gearSize} rotate={gearRotA} color={C.goldMid} />
      </View>
      <View style={{ position: 'absolute', right: size * 0.035, top: size * 0.82 }} pointerEvents="none">
        <GearWindow size={gearSize} rotate={gearRotB} color={C.steel} />
      </View>
      {/* Lueur d'ancrage (identique pour vrai point et leurre : seule l'haptique les distingue) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: faceOffset - 4,
          top: faceOffset - 4,
          width: faceSize + 8,
          height: faceSize + 8,
          borderRadius: (faceSize + 8) / 2,
          borderWidth: 3,
          borderColor: C.gold,
          opacity: engine.glowAnim,
          shadowColor: C.gold,
          shadowOpacity: 0.9,
          shadowRadius: 18,
        }}
      />
      <Animated.View
        style={{ position: 'absolute', left: faceOffset, top: faceOffset, width: faceSize, height: faceSize, transform: [{ rotate }] }}
        pointerEvents="none"
      >
        <DialFace size={faceSize} accent={accent} />
        {markers && markers.length > 0 ? (
          <Svg width={faceSize} height={faceSize} style={StyleSheet.absoluteFill}>
            {markers.map((z) => {
              const p = polar(faceSize / 2, faceSize / 2, faceSize * 0.315, z.angle);
              return (
                <G key={z.id}>
                  <Circle cx={p.x} cy={p.y} r={faceSize * 0.022} fill={z.kind === 'target' ? C.cctv : C.red} opacity={0.95} />
                  <Circle cx={p.x} cy={p.y} r={faceSize * 0.04} fill="none" stroke={z.kind === 'target' ? C.cctv : C.red} strokeWidth={1} opacity={0.6} />
                </G>
              );
            })}
          </Svg>
        ) : null}
      </Animated.View>
      {/* Jauge circulaire de maintien */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={holdR} stroke="#1B1F26" strokeWidth={size * 0.018} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={holdR}
            stroke={C.gold}
            strokeWidth={size * 0.018}
            fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={dashOffset as unknown as number}
            strokeLinecap="round"
          />
        </G>
        {/* Aiguille indicatrice fixe + reflet de verre */}
        <Defs>
          <SvgLinearGradient id="ldNeedle" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.redHi} />
            <Stop offset="1" stopColor={C.redDeep} />
          </SvgLinearGradient>
          <RadialGradient id="ldGlare" cx="35%" cy="20%" r="60%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Polygon
          points={`${size / 2},${faceOffset + size * 0.045} ${size / 2 - size * 0.028},${faceOffset - size * 0.012} ${size / 2 + size * 0.028},${faceOffset - size * 0.012}`}
          fill="url(#ldNeedle)"
          stroke="#000"
          strokeWidth={1}
        />
        <Circle cx={size / 2} cy={size / 2} r={faceSize / 2} fill="url(#ldGlare)" />
      </Svg>
      {/* Surface tactile dédiée, sans enfant : locationX/Y toujours relatifs à elle */}
      <View
        style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: size / 2 }}
        {...engine.pan.panHandlers}
        accessibilityLabel="Cadran du coffre-fort. Faites glisser votre doigt en cercle pour tourner."
      />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 13. INSTRUMENTS DU HUD : GOUPILLES, ESSAIS, STRESS, OSCILLOSCOPE, LECTURE
 * ════════════════════════════════════════════════════════════════════════ */

function PinRow({ total, done, errorKey, accent }: { total: number; done: number; errorKey: number; accent: string }) {
  const anims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const activePulse = useBlink(800);

  useEffect(() => {
    anims.forEach((a, i) => {
      Animated.spring(a, { toValue: i < done ? 1 : 0, friction: 5, tension: 120, useNativeDriver: true }).start();
    });
  }, [done, anims]);

  useEffect(() => {
    if (errorKey === 0) return;
    shake.setValue(0);
    flash.setValue(1);
    Animated.parallel([
      Animated.sequence(
        [10, -10, 8, -8, 5, -5, 2, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 45, useNativeDriver: true })),
      ),
      Animated.timing(flash, { toValue: 0, duration: 900, useNativeDriver: false }),
    ]).start();
  }, [errorKey, shake, flash]);

  const pinW = 34;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
      {Array.from({ length: total }).map((_, i) => {
        const isDone = i < done;
        const isActive = i === done;
        const color = flash.interpolate({ inputRange: [0, 1], outputRange: [isDone ? C.gold : isActive ? accent : C.steelDark, isDone ? C.gold : C.red] });
        return (
          <Animated.View
            key={i}
            style={{
              alignItems: 'center',
              transform: [
                { translateX: isDone ? 0 : shake },
                { translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
              ],
              opacity: isActive ? activePulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) : 1,
            }}
          >
            <Animated.View
              style={{
                width: pinW,
                height: 46,
                borderRadius: 7,
                borderWidth: 1.5,
                borderColor: color,
                backgroundColor: isDone ? 'rgba(232,176,75,0.15)' : '#0A0C0F',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingBottom: 4,
                overflow: 'hidden',
              }}
            >
              <Svg width={pinW - 6} height={36} viewBox="0 0 28 36">
                <Defs>
                  <SvgLinearGradient id={`pinG${i}`} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={isDone ? C.goldDeep : '#2B3038'} />
                    <Stop offset="0.5" stopColor={isDone ? C.goldHi : '#7D8592'} />
                    <Stop offset="1" stopColor={isDone ? C.goldDeep : '#2B3038'} />
                  </SvgLinearGradient>
                </Defs>
                {/* Ressort */}
                <Path d="M9 2 L19 5 L9 8 L19 11 L9 14" stroke={C.steelMid} strokeWidth={1.4} fill="none" opacity={isDone ? 0.3 : 0.9} />
                {/* Goupille supérieure + inférieure */}
                <Rect x={8} y={isDone ? 10 : 15} width={12} height={8} rx={2} fill={`url(#pinG${i})`} />
                <Rect x={8} y={isDone ? 19 : 24} width={12} height={10} rx={2} fill={`url(#pinG${i})`} />
                <Path d={isDone ? 'M2 19 L26 19' : 'M2 23.5 L26 23.5'} stroke={isDone ? C.cctv : C.red} strokeWidth={1} strokeDasharray="2 2" opacity={0.8} />
              </Svg>
            </Animated.View>
            <Text style={[styles.pinLabel, isDone && { color: C.gold }]}>{isDone ? 'OK' : `P${i + 1}`}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

function LivesLeds({ lives, max }: { lives: number; max: number }) {
  const blink = useBlink(500, lives === 1);
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Text style={styles.hudLabel}>ESSAIS</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
        {Array.from({ length: max }).map((_, i) => {
          const on = i < lives;
          return (
            <Animated.View
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: on ? (lives === 1 ? C.red : C.cctv) : '#1A1D22',
                borderWidth: 1,
                borderColor: on ? '#FFFFFF55' : '#2A2F38',
                shadowColor: lives === 1 ? C.red : C.cctv,
                shadowOpacity: on ? 0.9 : 0,
                shadowRadius: 6,
                opacity: on && lives === 1 ? blink : 1,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

/** Jauge de stress + chrono, auto-rafraîchie (10 i/s) sans re-rendre l'écran de jeu. */
function StressGauge({ getStatus }: { getStatus: () => { leftMs: number; limitMs: number; lives: number; maxLives: number } }) {
  const [, force] = useState(0);
  const blink = useRef(new Animated.Value(1)).current;
  const blinking = useRef(false);
  const blinkLoop = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    const t = setInterval(() => force((x) => (x + 1) % 1e6), 100);
    return () => {
      clearInterval(t);
      blinkLoop.current?.stop();
    };
  }, []);
  const s = getStatus();
  const timeRatio = s.limitMs > 0 ? 1 - s.leftMs / s.limitMs : 0;
  const lifeRatio = 1 - s.lives / s.maxLives;
  const stress = clamp(s.limitMs > 0 ? timeRatio * 0.65 + lifeRatio * 0.45 : lifeRatio * 0.9, 0, 1);
  const critical = stress > 0.7 || (s.limitMs > 0 && s.leftMs < 10000);
  useEffect(() => {
    if (critical && !blinking.current) {
      blinking.current = true;
      blinkLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(blink, { toValue: 0.25, duration: 220, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]),
      );
      blinkLoop.current.start();
    } else if (!critical && blinking.current) {
      blinking.current = false;
      blinkLoop.current?.stop();
      blinkLoop.current = null;
      blink.setValue(1);
    }
  }, [critical, blink]);
  const segs = 16;
  const lit = Math.round(stress * segs);
  return (
    <View style={{ flex: 1, alignItems: 'flex-end' }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={styles.hudLabel}>STRESS</Text>
        <Animated.Text style={[styles.chrono, { color: critical ? C.red : C.text, opacity: critical ? blink : 1 }]}>
          {s.limitMs > 0 ? formatClock(s.leftMs) : '∞ ILLIMITÉ'}
        </Animated.Text>
      </View>
      <Animated.View style={{ flexDirection: 'row', gap: 2.5, marginTop: 5, opacity: critical ? blink : 1 }}>
        {Array.from({ length: segs }).map((_, i) => {
          const on = i < lit;
          const col = i < segs * 0.5 ? C.cctv : i < segs * 0.75 ? C.gold : C.red;
          return <View key={i} style={{ width: 7, height: 14, borderRadius: 1.5, backgroundColor: on ? col : '#16191E' }} />;
        })}
      </Animated.View>
    </View>
  );
}

/** Oscilloscope haptique & sonore temps réel (style moniteur CCTV). */
function SignalScope({ width, height = 64, blind }: { width: number; height?: number; blind: boolean }) {
  const N = 64;
  const hap = useRef(new Array<number>(N).fill(0)).current;
  const aud = useRef(new Array<number>(N).fill(0)).current;
  const [, force] = useState(0);
  const phase = useRef(0);
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
  const toPath = (arr: number[], freq: number, amp: number, jitter: number) => {
    let d = '';
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * width;
      const e = blind ? Math.random() * 0.3 : arr[i];
      const y = mid + Math.sin(i * freq + phase.current) * e * amp * mid + (Math.random() - 0.5) * jitter;
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${clamp(y, 1, height - 1).toFixed(1)} `;
    }
    return d;
  };
  return (
    <View style={[styles.scope, { width, height }]}>
      <Svg width={width} height={height}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Line key={`v${i}`} x1={(i / 8) * width} y1={0} x2={(i / 8) * width} y2={height} stroke={C.cctvDim} strokeOpacity={0.35} strokeWidth={0.5} />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <Line key={`h${i}`} x1={0} y1={(i / 4) * height} x2={width} y2={(i / 4) * height} stroke={C.cctvDim} strokeOpacity={0.35} strokeWidth={0.5} />
        ))}
        <Path d={toPath(aud, 1.7, 0.7, 1)} stroke={C.cctv} strokeWidth={1.4} fill="none" opacity={0.85} />
        <Path d={toPath(hap, 0.9, 0.95, 0.6)} stroke={C.gold} strokeWidth={1.8} fill="none" />
      </Svg>
      <View style={styles.scopeLegend}>
        <Text style={[styles.scopeText, { color: C.gold }]}>■ HAPTIQUE</Text>
        <Text style={[styles.scopeText, { color: C.cctv }]}>■ AUDIO</Text>
      </View>
      {blind ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={[styles.scopeText, { color: C.red, fontSize: 11 }]}>SIGNAL MASQUÉ — MODE AVEUGLE</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Lecture numérique de l'angle, auto-abonnée à la valeur animée du cadran. */
function DialReadout({ engine, blind, cheat }: { engine: LockEngine; blind: boolean; cheat: boolean }) {
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
    <View style={styles.readout}>
      <Text style={styles.readoutLabel}>ANGLE</Text>
      <Text style={styles.readoutValue}>{blind ? '———' : `${reading.toString().padStart(3, '0')}°`}</Text>
      {cheat && delta != null ? (
        <Text style={[styles.readoutLabel, { color: engine.nearestKind === 'decoy' ? C.red : C.cctv }]}>
          Δ {delta.toFixed(1)}° {engine.nearestKind === 'decoy' ? 'LEURRE' : 'CIBLE'}
        </Text>
      ) : null}
    </View>
  );
}

/** Simulateur visuel : flash de bord d'écran à chaque impulsion haptique (pour émulateurs). */
function SimulatorFlash({ enabled }: { enabled: boolean }) {
  const op = useRef(new Animated.Value(0)).current;
  const [color, setColor] = useState(C.gold);
  useEffect(() => {
    if (!enabled) return;
    return PulseBus.subscribe((kind, energy, channel) => {
      if (channel !== 'haptic') return;
      setColor(kind === 'anchor' ? C.cctv : kind === 'decoy' || kind === 'error' || kind === 'alarm' ? C.red : C.gold);
      op.setValue(clamp(energy, 0.15, 1));
      Animated.timing(op, { toValue: 0, duration: kind === 'tick' ? 120 : 380, useNativeDriver: true }).start();
    });
  }, [enabled, op]);
  if (!enabled) return null;
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 5, borderColor: color, opacity: op }]} />;
}

/* ════════════════════════════════════════════════════════════════════════
 * 14. ICÔNES DE BUTIN (12 objets dessinés en SVG)
 * ════════════════════════════════════════════════════════════════════════ */

const LootIcon = memo(function LootIcon({ kind, hue, size = 56 }: { kind: LootKind; hue: string; size?: number }) {
  const id = `li_${kind}_${hue.replace('#', '')}`;
  const defs = (
    <Defs>
      <SvgLinearGradient id={`${id}_m`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
        <Stop offset="0.35" stopColor={hue} />
        <Stop offset="1" stopColor="#000000" stopOpacity={0.85} />
      </SvgLinearGradient>
      <SvgLinearGradient id={`${id}_g`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={C.goldHi} />
        <Stop offset="0.5" stopColor={C.gold} />
        <Stop offset="1" stopColor={C.goldDeep} />
      </SvgLinearGradient>
    </Defs>
  );
  const m = `url(#${id}_m)`;
  const g = `url(#${id}_g)`;
  let body: React.ReactNode = null;
  switch (kind) {
    case 'gem':
      body = (
        <G>
          <Polygon points="16,22 24,12 40,12 48,22 32,54" fill={m} stroke="#000" strokeWidth={0.8} />
          <Path d="M16 22 L48 22 M24 12 L28 22 L32 54 L36 22 L40 12 M28 22 L32 12 L36 22" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={0.8} fill="none" />
        </G>
      );
      break;
    case 'crown':
      body = (
        <G>
          <Path d="M10 46 L8 18 L20 30 L32 12 L44 30 L56 18 L54 46 Z" fill={g} stroke="#3A2506" strokeWidth={1} />
          <Rect x={10} y={46} width={44} height={7} rx={2} fill={g} stroke="#3A2506" strokeWidth={1} />
          <Circle cx={32} cy={36} r={4} fill={C.red} />
          <Circle cx={20} cy={39} r={2.6} fill="#3D7BFF" />
          <Circle cx={44} cy={39} r={2.6} fill="#2FE38A" />
          <Circle cx={8} cy={17} r={2.5} fill={C.goldHi} />
          <Circle cx={32} cy={11} r={2.5} fill={C.goldHi} />
          <Circle cx={56} cy={17} r={2.5} fill={C.goldHi} />
        </G>
      );
      break;
    case 'necklace':
      body = (
        <G>
          <Path d="M12 12 C14 36 50 36 52 12" stroke={g} strokeWidth={2.5} fill="none" />
          {Array.from({ length: 9 }).map((_, i) => {
            const t = i / 8;
            const x = 12 + t * 40;
            const y = 12 + Math.sin(t * Math.PI) * 18;
            return <Circle key={i} cx={x} cy={y} r={2.6} fill="#F7F1E3" stroke="#8A7F68" strokeWidth={0.5} />;
          })}
          <Polygon points="32,34 40,42 32,56 24,42" fill={m} stroke="#000" strokeWidth={0.6} />
        </G>
      );
      break;
    case 'painting':
      body = (
        <G>
          <Rect x={6} y={10} width={52} height={44} rx={2} fill={g} stroke="#3A2506" strokeWidth={1} />
          <Rect x={12} y={16} width={40} height={32} fill="#1A1410" />
          <Path d="M12 42 L24 28 L32 36 L40 24 L52 40 L52 48 L12 48 Z" fill={m} opacity={0.9} />
          <Circle cx={22} cy={23} r={4} fill={C.goldHi} opacity={0.85} />
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
              <Polygon points={`${x},${y + 14} ${x + 4},${y} ${x + 22},${y} ${x + 26},${y + 14}`} fill={g} stroke="#3A2506" strokeWidth={1} />
              <Path d={`M${x + 6} ${y + 3} L${x + 20} ${y + 3}`} stroke="#FFF6D8" strokeWidth={1} opacity={0.8} />
            </G>
          ))}
        </G>
      );
      break;
    case 'watch':
      body = (
        <G>
          <Rect x={29} y={4} width={6} height={7} rx={1.5} fill={g} />
          <Circle cx={32} cy={34} r={21} fill={g} stroke="#3A2506" strokeWidth={1} />
          <Circle cx={32} cy={34} r={16.5} fill="#F4EEDF" stroke="#8A6A2A" strokeWidth={0.8} />
          {Array.from({ length: 12 }).map((_, i) => {
            const p1 = polar(32, 34, 13.5, i * 30);
            const p2 = polar(32, 34, 15.5, i * 30);
            return <Line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#2A2010" strokeWidth={1} />;
          })}
          <Path d="M32 34 L32 23 M32 34 L40 38" stroke="#1A1208" strokeWidth={1.6} strokeLinecap="round" />
        </G>
      );
      break;
    case 'statue':
      body = (
        <G>
          <Rect x={18} y={50} width={28} height={7} rx={1.5} fill={g} />
          <Circle cx={32} cy={14} r={6} fill={m} />
          <Path d="M24 50 C22 38 24 26 32 22 C40 26 42 38 40 50 Z" fill={m} stroke="#000" strokeWidth={0.6} />
          <Path d="M26 30 L16 22 M38 30 L48 22" stroke={hue} strokeWidth={3} strokeLinecap="round" />
        </G>
      );
      break;
    case 'egg':
      body = (
        <G>
          <Ellipse cx={32} cy={33} rx={17} ry={22} fill={m} stroke="#000" strokeWidth={0.6} />
          <Path d="M15 30 C24 36 40 36 49 30 M17 40 C25 45 39 45 47 40" stroke={g} strokeWidth={2} fill="none" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Circle key={i} cx={20 + i * 6} cy={33.5 + Math.sin(i) * 0.5} r={1.6} fill="#FFFFFF" />
          ))}
          <Rect x={26} y={54} width={12} height={5} rx={1} fill={g} />
        </G>
      );
      break;
    case 'scroll':
      body = (
        <G>
          <Rect x={14} y={12} width={36} height={40} fill="#E9DBB4" stroke="#8A7647" strokeWidth={0.8} />
          <Rect x={10} y={8} width={44} height={6} rx={3} fill={g} />
          <Rect x={10} y={50} width={44} height={6} rx={3} fill={g} />
          {Array.from({ length: 6 }).map((_, i) => (
            <Line key={i} x1={19} y1={20 + i * 5} x2={45 - (i % 2) * 6} y2={20 + i * 5} stroke="#6A5A38" strokeWidth={1} />
          ))}
          <Circle cx={40} cy={44} r={4} fill={C.red} />
        </G>
      );
      break;
    case 'scepter':
      body = (
        <G>
          <Path d="M20 56 L40 18" stroke={g} strokeWidth={4} strokeLinecap="round" />
          <Circle cx={42} cy={14} r={8} fill={m} stroke="#000" strokeWidth={0.6} />
          <Path d="M36 22 L48 10 M34 14 L50 14" stroke={g} strokeWidth={1.6} />
          <Circle cx={27} cy={43} r={2.6} fill={C.red} />
        </G>
      );
      break;
    case 'ring':
      body = (
        <G>
          <Ellipse cx={32} cy={40} rx={17} ry={14} fill="none" stroke={g} strokeWidth={5} />
          <Polygon points="24,22 28,14 36,14 40,22 32,30" fill={m} stroke="#000" strokeWidth={0.6} />
        </G>
      );
      break;
    case 'vase':
      body = (
        <G>
          <Path d="M24 8 L40 8 L38 16 C50 24 50 44 40 54 L24 54 C14 44 14 24 26 16 Z" fill={m} stroke="#000" strokeWidth={0.6} />
          <Path d="M20 30 C28 34 36 34 44 30 M19 40 C27 44 37 44 45 40" stroke={g} strokeWidth={1.6} fill="none" />
        </G>
      );
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {defs}
      {body}
    </Svg>
  );
});

/* ════════════════════════════════════════════════════════════════════════
 * 15. ÉCRAN : SPLASH / DÉMARRAGE
 * ════════════════════════════════════════════════════════════════════════ */

function SplashScreen() {
  const blink = useBlink(600);
  const [line, setLine] = useState(0);
  const lines = ['INITIALISATION DU MODULE HAPTIQUE…', 'SYNTHÈSE DES SIGNAUX AUDIO…', 'DÉCHIFFREMENT DU DOSSIER LOCAL…', 'CONNEXION CCTV : HORS LIGNE ✓'];
  useEffect(() => {
    const t = setInterval(() => setLine((l) => Math.min(lines.length - 1, l + 1)), 260);
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <View style={[styles.fill, { alignItems: 'center', justifyContent: 'center' }]}>
      <MetalBackdrop />
      <AppIcon size={112} />
      <View style={{ marginTop: 28, alignItems: 'flex-start', width: 260 }}>
        {lines.slice(0, line + 1).map((l, i) => (
          <Text key={i} style={[styles.bootLine, i === line && { color: C.cctv }]}>
            {'> '}
            {l}
          </Text>
        ))}
        <Animated.Text style={[styles.bootLine, { opacity: blink, color: C.cctv }]}>█</Animated.Text>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 16. ÉCRAN : MENU PRINCIPAL (QG)
 * ════════════════════════════════════════════════════════════════════════ */

function StatCard({ label, value, sub, accent = C.gold, icon }: { label: string; value: string; sub?: string; accent?: string; icon: string }) {
  return (
    <LinearGradient colors={['#14171D', '#0A0C0F']} style={styles.statCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={14} color={accent} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text style={styles.statSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </LinearGradient>
  );
}

function MenuScreen({ career, onNavigate }: { career: Career; onNavigate: (s: ScreenName) => void }) {
  const { width } = useWindowDimensions();
  const nextTier = tierForLevel(career.level);
  const rate = career.heists + career.failures > 0 ? Math.round((career.heists / (career.heists + career.failures)) * 100) : 0;
  const ticker = useRef(new Animated.Value(0)).current;
  const [tickerW, setTickerW] = useState(0);
  useEffect(() => {
    if (!tickerW) return;
    ticker.setValue(0);
    const l = Animated.loop(Animated.timing(ticker, { toValue: 1, duration: tickerW * 22, easing: Easing.linear, useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, [ticker, tickerW]);
  const tickerText = `◉ CAM 01 · HALL  ◉ CAM 02 · CHAMBRE FORTE  ◉ CAM 03 · ESCALIER B  ◉ CIBLE SUIVANTE : ${nextTier.name.toUpperCase()}  ◉ AUCUNE CONNEXION RÉSEAU  ◉ DONNÉES 100 % LOCALES  `;
  return (
    <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <HeistLogo size={Math.min(width * 0.56, 230)} />
      </View>
      <View style={styles.statsGrid}>
        <StatCard label="CASSES RÉUSSIS" value={`${career.heists}`} sub={`${career.failures} arrestation(s)`} icon="vault" />
        <StatCard label="BUTIN TOTAL" value={formatMoneyShort(career.totalLoot)} sub={`${career.loot.length} objet(s)`} icon="coin" />
        <StatCard label="NIVEAU" value={`${career.level}`} sub={nextTier.type} accent={nextTier.accent} icon="dial" />
        <StatCard label="RÉUSSITE" value={`${rate} %`} sub={`${career.pinsCracked} goupille(s)`} accent={C.cctv} icon="wave" />
      </View>
      <View style={{ gap: 12, marginTop: 6 }}>
        <HeistButton
          label="LANCER LE CASSE"
          sub={`Cible : ${nextTier.name} — ${getHeistConfig(career.level).pins} goupille(s)`}
          variant="gold"
          icon={<Icon name="dial" size={30} color="#2A1A04" />}
          onPress={() => onNavigate('briefing')}
        />
        <HeistButton
          label="MON BUTIN SECRET"
          sub={`${career.loot.length} objet(s) — ${formatMoney(career.totalLoot)}`}
          icon={<Icon name="vault" size={28} />}
          onPress={() => onNavigate('vault')}
        />
        <HeistButton
          label="TUTORIEL SENSORIEL"
          sub={career.tutorialDone ? 'Diplôme obtenu ✓ — réviser' : 'Apprenez à sentir le point d’ancrage'}
          variant="cctv"
          icon={<Icon name="finger" size={28} color={C.cctv} />}
          onPress={() => onNavigate('tutorial')}
        />
        <HeistButton label="PARAMÈTRES" sub="Haptique, son, simulateur, triche" icon={<Icon name="gear" size={28} color={C.steelHi} />} onPress={() => onNavigate('settings')} />
      </View>
      <View style={styles.tickerWrap}>
        <Animated.View
          style={{
            flexDirection: 'row',
            width: 6000,
            transform: [{ translateX: ticker.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.max(1, tickerW)] }) }],
          }}
        >
          <Text style={styles.tickerText} onLayout={(e) => setTickerW(Math.round(e.nativeEvent.layout.width))}>
            {tickerText}
          </Text>
          <Text style={styles.tickerText}>{tickerText}</Text>
        </Animated.View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 18, opacity: 0.85 }}>
        <AppIcon size={40} />
        <View>
          <Text style={styles.footerTitle}>HAPTIC HEIST</Text>
          <Text style={styles.footerSub}>Aucun compte · Aucun serveur · Aucune pub</Text>
        </View>
      </View>
    </ScrollView>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 17. ÉCRAN : BRIEFING (dossier de la cible)
 * ════════════════════════════════════════════════════════════════════════ */

function BriefingScreen({
  career,
  level,
  onLevelChange,
  onStart,
  onBack,
}: {
  career: Career;
  level: number;
  onLevelChange: (l: number) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const cfg = getHeistConfig(level);
  const rows: [string, string][] = [
    ['MODÈLE', cfg.tier.safe],
    ['GOUPILLES', `${cfg.pins}`],
    ['LEURRES HAPTIQUES', cfg.decoys > 0 ? `${cfg.decoys}` : 'Aucun'],
    ['TEMPS IMPARTI', cfg.timeLimitMs > 0 ? formatClock(cfg.timeLimitMs).slice(0, 5) : 'Illimité'],
    ['TOLÉRANCE', `±${cfg.lockWindow.toFixed(1)}°`],
    ['ESSAIS', `${cfg.lives}`],
    ['BUTIN ESTIMÉ', `${formatMoneyShort(cfg.lootMin)} – ${formatMoneyShort(cfg.lootMax)}`],
  ];
  return (
    <ScrollView contentContainerStyle={styles.scrollPad}>
      <ScreenHeader title="DOSSIER DE MISSION" onBack={onBack} />
      <LinearGradient colors={['#15181E', '#090A0D']} style={[styles.card, { borderColor: cfg.tier.accent + '66' }]}>
        <Text style={[styles.dossierType, { color: cfg.tier.accent }]}>{cfg.tier.type} · NIVEAU {level}</Text>
        <Text style={styles.dossierName}>{cfg.tier.name}</Text>
        <Text style={styles.dossierCity}>📍 {cfg.tier.city}</Text>
        <View style={styles.divider} />
        {rows.map(([k, v]) => (
          <View key={k} style={styles.dossierRow}>
            <Text style={styles.dossierKey}>{k}</Text>
            <Text style={styles.dossierVal}>{v}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <Text style={styles.dossierNote}>
          {cfg.decoys > 0
            ? 'Renseignement : ce coffre contient des leurres. Le vrai point d’ancrage donne une DOUBLE impulsion feutrée. Un leurre donne un SEUL choc sec — relâchez-le immédiatement.'
            : 'Renseignement : mécanisme simple. Tournez lentement, sentez le tremblement grandir, puis immobilisez-vous une seconde sur la double impulsion.'}
        </Text>
        {career.settings.blind ? <Text style={[styles.dossierNote, { color: C.gold }]}>MODE AVEUGLE ACTIF : butin ×1,5</Text> : null}
      </LinearGradient>
      {career.settings.cheat ? (
        <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={[styles.dossierKey, { color: C.red }]}>TRICHE · CHOIX DU NIVEAU</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <HeistButton compact label="−" onPress={() => onLevelChange(Math.max(1, level - 1))} />
            <Text style={styles.dossierVal}>{level}</Text>
            <HeistButton compact label="+" onPress={() => onLevelChange(Math.min(30, level + 1))} />
          </View>
        </View>
      ) : null}
      <HeistButton label="COMMENCER LE CASSE" sub="Posez le pouce sur le cadran" variant="gold" icon={<Icon name="play" size={26} color="#2A1A04" />} onPress={onStart} />
    </ScrollView>
  );
}

function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={() => {
            HapticEngine.ui();
            onBack();
          }}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityLabel="Retour"
        >
          <Icon name="back" size={22} color={C.steelHi} />
        </Pressable>
      ) : (
        <View style={{ width: 38 }} />
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ minWidth: 38, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 18. ÉCRAN : LE CASSE
 * ════════════════════════════════════════════════════════════════════════ */

type HeistPhase = 'intro' | 'playing' | 'paused' | 'cracked' | 'busted';

function HeistScreen({
  cfg,
  settings,
  onSuccess,
  onFail,
  onAbort,
}: {
  cfg: HeistConfig;
  settings: Settings;
  onSuccess: (r: Omit<HeistResult, 'loot'>) => void;
  onFail: (r: HeistResult) => void;
  onAbort: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<HeistPhase>('intro');
  const [count, setCount] = useState(3);
  const [pinsDone, setPinsDone] = useState(0);
  const [lives, setLives] = useState(cfg.lives);
  const [errorKey, setErrorKey] = useState(0);
  const [status, setStatus] = useState<{ text: string; color: string }>({ text: 'CONNEXION AU MÉCANISME…', color: C.textDim });
  const [zones, setZones] = useState<Zone[]>([]);
  const redFlash = useRef(new Animated.Value(0)).current;
  const goldFlash = useRef(new Animated.Value(0)).current;

  const clock = useRef({ startedAt: 0, pausedAcc: 0, pausedAt: 0, traps: 0, ended: false, lastBeat: 0 }).current;
  const livesRef = useRef(lives);
  livesRef.current = lives;
  const pinsRef = useRef(pinsDone);
  pinsRef.current = pinsDone;

  const elapsed = useCallback(() => {
    if (!clock.startedAt) return 0;
    const now = clock.pausedAt || Date.now();
    return now - clock.startedAt - clock.pausedAcc;
  }, [clock]);

  const dialSize = Math.min(width - 40, height * 0.43, 380);

  const setTimedStatus = useCallback((text: string, color: string, resetMs = 0) => {
    setStatus({ text, color });
    if (resetMs > 0) {
      setTimeout(() => {
        if (!clock.ended) setStatus({ text: 'CHERCHEZ LE POINT D’ANCRAGE', color: C.textDim });
      }, resetMs);
    }
  }, [clock]);

  const finishFail = useCallback(
    (reason: 'traps' | 'time') => {
      if (clock.ended) return;
      clock.ended = true;
      setPhase('busted');
      HapticEngine.alarm(10);
      SoundEngine.startLoop('siren', 0.8);
      setStatus({ text: reason === 'time' ? '⏱ TEMPS ÉCOULÉ — ALARME GÉNÉRALE' : '🚨 ALARME DÉCLENCHÉE', color: C.red });
      Animated.loop(
        Animated.sequence([
          Animated.timing(redFlash, { toValue: 0.55, duration: 160, useNativeDriver: true }),
          Animated.timing(redFlash, { toValue: 0.1, duration: 160, useNativeDriver: true }),
        ]),
        { iterations: 5 },
      ).start();
      const t = elapsed();
      setTimeout(() => {
        onFail({
          level: cfg.level,
          success: false,
          timeMs: t,
          pinsDone: pinsRef.current,
          pinsTotal: cfg.pins,
          traps: clock.traps,
          livesLeft: livesRef.current,
          reason,
          tierName: cfg.tier.name,
          lootLostEstimate: Math.round((cfg.lootMin + cfg.lootMax) / 2 / 1000) * 1000,
        });
      }, 1700);
    },
    [cfg, clock, elapsed, onFail, redFlash],
  );

  const engineCfg = useMemo<EngineConfig>(
    () => ({
      pins: cfg.pins,
      decoys: cfg.decoys,
      nearWindow: cfg.nearWindow + (settings.cheat ? 2 : 0),
      lockWindow: cfg.lockWindow + (settings.cheat ? 1 : 0),
      holdMs: cfg.holdMs,
      decoyTrapRatio: cfg.decoyTrapRatio,
      sensitivity: SENSITIVITY_VALUES[settings.sensitivity],
      autoRegenerate: true,
    }),
    [cfg, settings.cheat, settings.sensitivity],
  );

  const engine = useLockEngine(
    engineCfg,
    {
      onAnchor: () => setTimedStatus('◆ ANCRAGE — NE BOUGEZ PLUS', C.gold),
      onHoldBroken: (reason) =>
        setTimedStatus(
          reason === 'released'
            ? 'DOIGT LEVÉ — GOUPILLE RÉINITIALISÉE'
            : reason === 'tremble'
              ? 'TREMBLEMENT — GOUPILLE RÉINITIALISÉE'
              : 'GLISSEMENT — GOUPILLE RÉINITIALISÉE',
          C.redHi,
          1200,
        ),
      onPinUnlocked: (idx) => {
        setPinsDone(idx + 1);
        goldFlash.setValue(0.5);
        Animated.timing(goldFlash, { toValue: 0, duration: 600, useNativeDriver: true }).start();
        if (idx + 1 < cfg.pins) setTimedStatus(`✓ GOUPILLE ${idx + 1} DÉBLOQUÉE`, C.cctv, 1300);
      },
      onAllUnlocked: () => {
        if (clock.ended) return;
        clock.ended = true;
        setPhase('cracked');
        setStatus({ text: '✓ MÉCANISME CRAQUÉ — OUVERTURE…', color: C.cctv });
        SoundEngine.play('bolt', 1);
        setTimeout(() => SoundEngine.play('bolt', 1), 220);
        const t = elapsed();
        setTimeout(() => {
          onSuccess({
            level: cfg.level,
            success: true,
            timeMs: t,
            pinsDone: cfg.pins,
            pinsTotal: cfg.pins,
            traps: clock.traps,
            livesLeft: livesRef.current,
            reason: 'success',
            tierName: cfg.tier.name,
            lootLostEstimate: 0,
          });
        }, 1100);
      },
      onTrap: () => {
        clock.traps += 1;
        setErrorKey((k) => k + 1);
        redFlash.setValue(0.6);
        Animated.timing(redFlash, { toValue: 0, duration: 700, useNativeDriver: true }).start();
        const left = livesRef.current - 1;
        setLives(left);
        if (left <= 0) finishFail('traps');
        else setTimedStatus(`⚠ LEURRE ! ESSAIS RESTANTS : ${left}`, C.red, 1600);
      },
      onZonesChanged: (z) => setZones([...z]),
    },
    phase === 'playing',
    dialSize,
  );

  // Compte à rebours d'introduction
  useEffect(() => {
    if (phase !== 'intro') return;
    if (count <= 0) {
      engine.reset();
      engine.regenerate();
      clock.startedAt = Date.now();
      setPhase('playing');
      setStatus({ text: 'CHERCHEZ LE POINT D’ANCRAGE', color: C.textDim });
      HapticEngine.impact(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }
    HapticEngine.impact(Haptics.ImpactFeedbackStyle.Medium);
    SoundEngine.play('ui', 0.8);
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, count, engine, clock]);

  // Chrono, battements de cœur & fin de temps
  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setInterval(() => {
      if (cfg.timeLimitMs <= 0 || clock.ended) return;
      const left = cfg.timeLimitMs - elapsed();
      if (left <= 0) finishFail('time');
      else if (left < 15000 || livesRef.current === 1) {
        const now = Date.now();
        const period = left < 8000 ? 520 : 820;
        if (now - clock.lastBeat > period) {
          clock.lastBeat = now;
          SoundEngine.play('heartbeat', left < 8000 ? 0.9 : 0.6);
        }
      }
    }, 100);
    return () => clearInterval(t);
  }, [phase, cfg.timeLimitMs, clock, elapsed, finishFail]);

  const pause = useCallback(() => {
    if (phase !== 'playing') return;
    clock.pausedAt = Date.now();
    engine.release();
    setPhase('paused');
  }, [phase, clock, engine]);

  const resume = useCallback(() => {
    if (clock.pausedAt) clock.pausedAcc += Date.now() - clock.pausedAt;
    clock.pausedAt = 0;
    setPhase('playing');
  }, [clock]);

  // Pause automatique en arrière-plan + bouton retour Android
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') pause();
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'playing') pause();
      return true;
    });
    return () => {
      sub.remove();
      back.remove();
    };
  }, [pause, phase]);

  useEffect(
    () => () => {
      clock.ended = true;
      HapticEngine.cancelAll();
    },
    [clock],
  );

  const getStatus = useCallback(
    () => ({ leftMs: cfg.timeLimitMs > 0 ? Math.max(0, cfg.timeLimitMs - elapsed()) : 0, limitMs: cfg.timeLimitMs, lives: livesRef.current, maxLives: cfg.lives }),
    [cfg, elapsed],
  );

  const showMarkers = settings.cheat ? zones : null;

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 8 }]}>
      <MetalBackdrop tint={cfg.tier.accent} />
      <View style={styles.heistTop}>
        <Pressable onPress={pause} hitSlop={12} style={styles.headerBtn} accessibilityLabel="Pause">
          <Icon name="pause" size={20} color={C.steelHi} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[styles.heistTier, { color: cfg.tier.accent }]}>
            {cfg.tier.type} · NIV. {cfg.level}
          </Text>
          <Text style={styles.heistName} numberOfLines={1}>
            {cfg.tier.name}
          </Text>
        </View>
        <CctvHud cam={`0${(cfg.level % 9) + 1}`} label="COFFRE" />
      </View>

      <View style={styles.hudRow}>
        <LivesLeds lives={lives} max={cfg.lives} />
        <StressGauge getStatus={getStatus} />
      </View>

      <View style={{ marginTop: 10 }}>
        <PinRow total={cfg.pins} done={pinsDone} errorKey={errorKey} accent={cfg.tier.accent} />
      </View>

      <Text style={[styles.statusLine, { color: status.color }]} numberOfLines={1} adjustsFontSizeToFit>
        {status.text}
      </Text>

      <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <LockDial size={dialSize} engine={engine} accent={cfg.tier.accent} markers={showMarkers} />
      </View>

      <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SignalScope width={width - 32 - 96} blind={settings.blind} />
        <DialReadout engine={engine} blind={settings.blind} cheat={settings.cheat} />
      </View>
      <Text style={styles.heistHint}>Tournez lentement · Fermez les yeux · Sentez la double impulsion</Text>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: C.red, opacity: redFlash }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: C.gold, opacity: goldFlash }]} />
      <SimulatorFlash enabled={settings.simulator} />

      {phase === 'intro' ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayKicker}>INFILTRATION EN COURS</Text>
          <Text style={styles.countdown}>{count > 0 ? count : 'GO'}</Text>
          <Text style={styles.overlaySub}>
            {cfg.pins} goupille(s){cfg.decoys > 0 ? ` · ${cfg.decoys} leurre(s)` : ''}
            {cfg.timeLimitMs > 0 ? ` · ${Math.round(cfg.timeLimitMs / 1000)} s` : ''}
          </Text>
        </View>
      ) : null}

      {phase === 'paused' ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayKicker}>OPÉRATION SUSPENDUE</Text>
          <Text style={[styles.countdown, { fontSize: 44 }]}>PAUSE</Text>
          <View style={{ width: '80%', gap: 12, marginTop: 20 }}>
            <HeistButton label="REPRENDRE" variant="gold" onPress={resume} icon={<Icon name="play" size={24} color="#2A1A04" />} />
            <HeistButton
              label="ABANDONNER"
              sub="Retour au QG sans pénalité"
              variant="red"
              onPress={() => {
                clock.ended = true;
                onAbort();
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 19. ÉCRAN : SUCCÈS — LA RÉVÉLATION (porte de coffre mécanique)
 * ════════════════════════════════════════════════════════════════════════ */

function VaultDoorArt({ size, wheelRot, boltAnim }: { size: number; wheelRot: Animated.AnimatedInterpolation<string>; boltAnim: Animated.Value }) {
  const c = size / 2;
  const rivets = Array.from({ length: 24 }, (_, i) => polar(c, c, size * 0.44, i * 15));
  const bolts = Array.from({ length: 8 }, (_, i) => i * 45 + 22.5);
  const boltLen = size * 0.12;
  return (
    <View style={{ width: size, height: size }}>
      {bolts.map((a) => (
        <Animated.View
          key={a}
          style={{
            position: 'absolute',
            left: c - size * 0.025,
            top: c - boltLen / 2,
            width: size * 0.05,
            height: boltLen,
            borderRadius: 4,
            backgroundColor: C.steel,
            borderWidth: 1,
            borderColor: '#0A0B0E',
            transform: [
              { rotate: `${a}deg` },
              { translateY: boltAnim.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.52, -size * 0.4] }) },
            ],
          }}
        >
          <LinearGradient colors={['#E6EAF0', '#5A6270', '#2A2F37']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: 3 }]} />
        </Animated.View>
      ))}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="vdDoor" cx="40%" cy="35%" r="75%">
            <Stop offset="0" stopColor="#5C6472" />
            <Stop offset="0.5" stopColor="#262B33" />
            <Stop offset="1" stopColor="#0B0C0F" />
          </RadialGradient>
          <SvgLinearGradient id="vdRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={C.goldHi} />
            <Stop offset="0.5" stopColor={C.goldMid} />
            <Stop offset="1" stopColor={C.goldDeep} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={size * 0.47} fill="url(#vdDoor)" stroke="#000" strokeWidth={2} />
        <Circle cx={c} cy={c} r={size * 0.465} fill="none" stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={1} />
        {rivets.map((r, i) => (
          <Circle key={i} cx={r.x} cy={r.y} r={size * 0.009} fill={C.steelHi} opacity={0.7} />
        ))}
        <Circle cx={c} cy={c} r={size * 0.38} fill="none" stroke="#0A0B0E" strokeWidth={3} />
        <Circle cx={c} cy={c} r={size * 0.36} fill="none" stroke="url(#vdRing)" strokeWidth={2} />
        <Circle cx={c} cy={c} r={size * 0.27} fill="none" stroke="#000" strokeOpacity={0.6} strokeWidth={size * 0.03} />
        <SvgText x={c} y={c + size * 0.33} fontSize={size * 0.035} fill={C.goldHi} textAnchor="middle" fontWeight="700" letterSpacing={3}>
          HAPTIC · SAFE · CO
        </SvgText>
      </Svg>
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, transform: [{ rotate: wheelRot }] }}>
        <Svg width={size} height={size}>
          {Array.from({ length: 6 }).map((_, i) => {
            const p = polar(c, c, size * 0.23, i * 60);
            return (
              <G key={i}>
                <Line x1={c} y1={c} x2={p.x} y2={p.y} stroke={C.steelHi} strokeWidth={size * 0.025} strokeLinecap="round" />
                <Circle cx={p.x} cy={p.y} r={size * 0.03} fill={C.gold} stroke="#3A2506" strokeWidth={1} />
              </G>
            );
          })}
          <Circle cx={c} cy={c} r={size * 0.075} fill={C.steelMid} stroke={C.steelHi} strokeWidth={2} />
          <Circle cx={c} cy={c} r={size * 0.03} fill={C.gold} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function SuccessScreen({
  result,
  onTakeLoot,
  onNext,
}: {
  result: HeistResult;
  onTakeLoot: () => void;
  onNext: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const loot = result.loot as LootItem;
  const doorSize = Math.min(width * 0.78, height * 0.45, 380);
  const wheel = useRef(new Animated.Value(0)).current;
  const bolts = useRef(new Animated.Value(0)).current;
  const swing = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const rays = useRef(new Animated.Value(0)).current;
  const alarmOff = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  const counter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    HapticEngine.vaultOpen();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    [0, 180, 360, 540].forEach((ms) => at(ms, () => SoundEngine.play('bolt', 0.95)));
    at(900, () => SoundEngine.play('alarmOff', 0.8));
    at(1500, () => SoundEngine.play('hiss', 0.8));
    at(2350, () => {
      SoundEngine.play('reveal', 0.85);
      SoundEngine.play('coins', 0.9);
      HapticEngine.notify(Haptics.NotificationFeedbackType.Success);
    });
    Animated.sequence([
      Animated.parallel([
        Animated.timing(wheel, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bolts, { toValue: 1, duration: 800, delay: 100, easing: Easing.in(Easing.back(1.5)), useNativeDriver: true }),
        Animated.sequence([Animated.delay(800), Animated.timing(alarmOff, { toValue: 1, duration: 300, useNativeDriver: true })]),
      ]),
      Animated.delay(250),
      Animated.timing(swing, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(zoom, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.spring(card, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
      ]),
    ]).start();
    const r = Animated.loop(Animated.timing(rays, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
    r.start();
    const id = counter.addListener(({ value }) => setShown(value));
    at(2400, () => Animated.timing(counter, { toValue: loot.value, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start());
    return () => {
      timers.forEach(clearTimeout);
      r.stop();
      counter.removeListener(id);
    };
  }, [wheel, bolts, swing, zoom, card, rays, alarmOff, counter, loot.value]);

  const wheelRot = wheel.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] });
  const rar = RARITY_META[loot.rarity];

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <MetalBackdrop tint={C.gold} />
      <Animated.View style={[styles.alarmOffBanner, { opacity: alarmOff, transform: [{ translateY: alarmOff.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}>
        <View style={[styles.recDot, { backgroundColor: C.cctv }]} />
        <Text style={styles.alarmOffText}>SYSTÈME D’ALARME DÉSACTIVÉ · CAMÉRAS EN BOUCLE</Text>
      </Animated.View>

      <View style={{ height: doorSize + 20, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ alignItems: 'center', justifyContent: 'center', transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }] }}>
          {/* Cadre et intérieur du coffre */}
          <View style={[styles.vaultFrame, { width: doorSize + 16, height: doorSize + 16, borderRadius: (doorSize + 16) / 2 }]}>
            <LinearGradient colors={['#2B1C05', '#0A0703']} style={[StyleSheet.absoluteFill, { borderRadius: (doorSize + 16) / 2 }]} />
            <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', opacity: swing }]}>
              <Animated.View
                style={{
                  position: 'absolute',
                  transform: [{ rotate: rays.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
                }}
              >
                <Svg width={doorSize} height={doorSize}>
                  <Defs>
                    <RadialGradient id="raysG" cx="50%" cy="50%" r="50%">
                      <Stop offset="0" stopColor={C.goldHi} stopOpacity={0.9} />
                      <Stop offset="1" stopColor={C.gold} stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const a1 = polar(doorSize / 2, doorSize / 2, doorSize / 2, i * 30 - 5);
                    const a2 = polar(doorSize / 2, doorSize / 2, doorSize / 2, i * 30 + 5);
                    return <Polygon key={i} points={`${doorSize / 2},${doorSize / 2} ${a1.x},${a1.y} ${a2.x},${a2.y}`} fill="url(#raysG)" opacity={0.35} />;
                  })}
                  <Circle cx={doorSize / 2} cy={doorSize / 2} r={doorSize * 0.3} fill="url(#raysG)" opacity={0.6} />
                </Svg>
              </Animated.View>
              <LootIcon kind={loot.kind} hue={loot.hue} size={doorSize * 0.36} />
            </Animated.View>
          </View>
          {/* La porte qui pivote sur ses gonds */}
          <Animated.View
            style={{
              position: 'absolute',
              transformOrigin: 'left',
              transform: [{ perspective: 900 }, { rotateY: swing.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-112deg'] }) }],
              opacity: swing.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            }}
          >
            <VaultDoorArt size={doorSize} wheelRot={wheelRot} boltAnim={bolts} />
          </Animated.View>
        </Animated.View>
      </View>

      <Animated.View
        style={{
          paddingHorizontal: 16,
          opacity: card,
          transform: [{ scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }, { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        }}
      >
        <LinearGradient colors={['#1C1709', '#0A0805']} style={[styles.card, { borderColor: rar.color + 'AA', alignItems: 'center' }]}>
          <Text style={[styles.rarityBadge, { color: rar.color, borderColor: rar.color }]}>{rar.label}</Text>
          <Text style={styles.lootName}>{loot.name}</Text>
          <Text style={styles.lootValue}>{formatMoney(Math.round(shown))}</Text>
          <Text style={styles.lootMeta}>
            {result.tierName} · {formatClock(result.timeMs)} · {result.traps} leurre(s) déclenché(s)
            {loot.blind ? ' · AVEUGLE ×1,5' : ''}
          </Text>
        </LinearGradient>
        <View style={{ gap: 10, marginTop: 12 }}>
          <HeistButton
            label="EMPORTER LE BUTIN"
            sub="Direction la salle au trésor"
            variant="gold"
            icon={<Icon name="coin" size={26} color="#2A1A04" />}
            onPress={() => {
              SoundEngine.play('coins', 1);
              HapticEngine.notify(Haptics.NotificationFeedbackType.Success);
              onTakeLoot();
            }}
          />
          <HeistButton label="CASSE SUIVANT" sub={`Niveau ${result.level + 1} · ${tierForLevel(result.level + 1).name}`} onPress={onNext} icon={<Icon name="dial" size={24} />} />
        </View>
      </Animated.View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 20. ÉCRAN : GAME OVER — ARRÊTÉ
 * ════════════════════════════════════════════════════════════════════════ */

function PoliceBeacon({ color, size, delay }: { color: string; size: number; delay: number }) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.timing(rot, { toValue: 1, duration: 900, delay, easing: Easing.linear, useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, [rot, delay]);
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`beam${color.replace('#', '')}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.85} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Polygon points={`${size / 2},${size / 2} ${size * 0.1},0 ${size * 0.9},0`} fill={`url(#beam${color.replace('#', '')})`} />
        <Polygon points={`${size / 2},${size / 2} ${size * 0.1},${size} ${size * 0.9},${size}`} fill={`url(#beam${color.replace('#', '')})`} />
      </Svg>
    </Animated.View>
  );
}

function GameOverScreen({ result, onRetry, onEscape }: { result: HeistResult; onRetry: () => void; onEscape: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const strobe = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const caseNo = useMemo(() => `${randInt(1000, 9999)}-${String.fromCharCode(65 + randInt(0, 25))}`, []);

  useEffect(() => {
    HapticEngine.alarm(14);
    SoundEngine.startLoop('siren', 0.75);
    const s = Animated.loop(
      Animated.sequence([
        Animated.timing(strobe, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(strobe, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]),
    );
    s.start();
    Animated.sequence([10, -10, 8, -8, 6, -6, 3, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 55, useNativeDriver: true }))).start();
    return () => {
      s.stop();
      SoundEngine.stopLoop('siren');
      HapticEngine.cancelAll();
    };
  }, [strobe, shake]);

  const rows: [string, string][] = [
    ['LIEU', result.tierName],
    ['NIVEAU', `${result.level}`],
    ['GOUPILLES CROCHETÉES', `${result.pinsDone} / ${result.pinsTotal}`],
    ['LEURRES DÉCLENCHÉS', `${result.traps}`],
    ['TEMPS SUR PLACE', formatClock(result.timeMs)],
    ['MOTIF', result.reason === 'time' ? 'Temps écoulé' : 'Alarme silencieuse'],
    ['BUTIN PERDU (EST.)', formatMoney(result.lootLostEstimate)],
  ];

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#030003' }]} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: strobe }]} pointerEvents="none">
        <LinearGradient colors={['rgba(255,30,50,0.65)', 'rgba(255,30,50,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 0.6 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: strobe.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]} pointerEvents="none">
        <LinearGradient colors={['rgba(40,110,255,0.6)', 'rgba(40,110,255,0)']} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 0.6 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={{ position: 'absolute', top: insets.top - 60, left: -60, opacity: 0.7 }} pointerEvents="none">
        <PoliceBeacon color={C.red} size={width * 0.75} delay={0} />
      </View>
      <View style={{ position: 'absolute', top: insets.top - 60, right: -60, opacity: 0.7 }} pointerEvents="none">
        <PoliceBeacon color={C.blue} size={width * 0.75} delay={450} />
      </View>
      <MetalBackdrop tint={C.red} scanlines />

      <ScrollView contentContainerStyle={[styles.scrollPad, { paddingTop: 40 }]}>
        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 18, marginBottom: 10 }}>
            <Animated.View style={{ opacity: strobe }}>
              <Icon name="siren" size={42} color={C.red} />
            </Animated.View>
            <Animated.View style={{ opacity: strobe.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }) }}>
              <Icon name="siren" size={42} color={C.blue} />
            </Animated.View>
          </View>
          <Animated.Text style={[styles.bustedTitle, { transform: [{ translateX: shake }] }]}>ARRÊTÉ</Animated.Text>
          <Text style={styles.bustedSub}>DOSSIER DE POLICE N° {caseNo}</Text>
        </View>
        <View style={[styles.card, { borderColor: C.red + '88', backgroundColor: 'rgba(10,4,6,0.85)', marginTop: 18 }]}>
          {rows.map(([k, v]) => (
            <View key={k} style={styles.dossierRow}>
              <Text style={styles.dossierKey}>{k}</Text>
              <Text style={[styles.dossierVal, k.startsWith('BUTIN') && { color: C.red }]}>{v}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <Text style={styles.dossierNote}>
            Conseil du receleur : le vrai point d’ancrage = double impulsion feutrée. Un choc sec unique = leurre. Relâchez-le avant 0,7 s.
          </Text>
        </View>
        <View style={{ gap: 12, marginTop: 8 }}>
          <HeistButton label="RÉESSAYER" sub={`Même cible · niveau ${result.level}`} variant="red" onPress={onRetry} icon={<Icon name="dial" size={26} color="#FFFFFF" />} />
          <HeistButton label="S’ÉCHAPPER" sub="Retour discret au QG" onPress={onEscape} icon={<Icon name="back" size={24} color={C.steelHi} />} />
        </View>
      </ScrollView>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 21. ÉCRAN : MON BUTIN SECRET (galerie / salle au trésor)
 * ════════════════════════════════════════════════════════════════════════ */

const LootCard = memo(function LootCard({ item, highlight }: { item: LootItem; highlight: boolean }) {
  const [open, setOpen] = useState(false);
  const rar = RARITY_META[item.rarity];
  const glow = useRef(new Animated.Value(highlight ? 1 : 0)).current;
  useEffect(() => {
    if (!highlight) return;
    Animated.timing(glow, { toValue: 0, duration: 2600, useNativeDriver: false }).start();
  }, [highlight, glow]);
  return (
    <Pressable
      onPress={() => {
        HapticEngine.ui();
        setOpen((o) => !o);
      }}
    >
      <Animated.View
        style={[
          styles.lootCard,
          {
            borderColor: glow.interpolate({ inputRange: [0, 1], outputRange: [rar.color + '55', C.goldHi] }),
          },
        ]}
      >
        <LinearGradient colors={['#14171D', '#0A0B0E']} style={StyleSheet.absoluteFill} />
        <View style={[styles.lootIconWrap, { borderColor: rar.color + '66' }]}>
          <LootIcon kind={item.kind} hue={item.hue} size={50} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.lootCardRarity, { color: rar.color }]}>
            {rar.label}
            {item.blind ? ' · AVEUGLE' : ''}
          </Text>
          <Text style={styles.lootCardName} numberOfLines={open ? 3 : 1}>
            {item.name}
          </Text>
          <Text style={styles.lootCardValue}>{formatMoney(item.value)}</Text>
          {open ? (
            <Text style={styles.lootCardMeta}>
              {item.location}
              {'\n'}Niveau {item.level} · {formatDate(item.date)}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
});

function VaultScreen({ career, highlightId, onBack }: { career: Career; highlightId: string | null; onBack: () => void }) {
  const [filter, setFilter] = useState<'all' | Rarity>('all');
  const [sort, setSort] = useState<'date' | 'value'>('date');
  const items = useMemo(() => {
    const list = filter === 'all' ? career.loot : career.loot.filter((l) => l.rarity === filter);
    return [...list].sort((a, b) => (sort === 'date' ? b.date - a.date : b.value - a.value));
  }, [career.loot, filter, sort]);
  const top = useMemo(() => career.loot.reduce<LootItem | null>((m, l) => (!m || l.value > m.value ? l : m), null), [career.loot]);
  const filters: ('all' | Rarity)[] = ['all', 'legendaire', 'epique', 'rare', 'commun'];

  return (
    <View style={styles.fill}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.scrollPad, { gap: 10 }]}
        initialNumToRender={10}
        windowSize={7}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <ScreenHeader title="MON BUTIN SECRET" onBack={onBack} />
            <LinearGradient colors={['#2A1E08', '#0C0905']} style={[styles.card, { borderColor: C.gold + '66', alignItems: 'center' }]}>
              <Text style={styles.statLabel}>VALEUR TOTALE DE LA SALLE AU TRÉSOR</Text>
              <Text style={[styles.lootValue, { fontSize: 32 }]} adjustsFontSizeToFit numberOfLines={1}>
                {formatMoney(career.totalLoot)}
              </Text>
              <Text style={styles.lootMeta}>
                {career.loot.length} objet(s) · {career.heists} casse(s) · record {career.bestTimeMs ? formatClock(career.bestTimeMs) : '—'}
              </Text>
              {top ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <LootIcon kind={top.kind} hue={top.hue} size={34} />
                  <Text style={[styles.lootMeta, { color: C.goldHi, flexShrink: 1 }]} numberOfLines={2}>
                    Pièce maîtresse : {top.name}
                  </Text>
                </View>
              ) : null}
            </LinearGradient>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {filters.map((f) => {
                const active = f === filter;
                const color = f === 'all' ? C.steelHi : RARITY_META[f].color;
                return (
                  <Pressable
                    key={f}
                    onPress={() => {
                      HapticEngine.ui();
                      setFilter(f);
                    }}
                    style={[styles.chip, { borderColor: active ? color : C.line, backgroundColor: active ? color + '22' : 'transparent' }]}
                  >
                    <Text style={[styles.chipText, { color: active ? color : C.textDim }]}>{f === 'all' ? 'TOUT' : RARITY_META[f].label}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  HapticEngine.ui();
                  setSort((s) => (s === 'date' ? 'value' : 'date'));
                }}
                style={[styles.chip, { borderColor: C.cctvDim }]}
              >
                <Text style={[styles.chipText, { color: C.cctv }]}>TRI : {sort === 'date' ? 'RÉCENT' : 'VALEUR'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
            <Icon name="vault" size={64} color={C.steelDark} />
            <Text style={styles.emptyText}>La salle au trésor est vide.</Text>
            <Text style={[styles.emptyText, { fontSize: 12, color: C.textMute }]}>Chaque coffre craqué y dépose son butin, stocké uniquement sur cet appareil.</Text>
          </View>
        }
        renderItem={({ item }) => <LootCard item={item} highlight={item.id === highlightId} />}
      />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 22. ÉCRAN : TUTORIEL SENSORIEL INTERACTIF
 * ════════════════════════════════════════════════════════════════════════ */

const TUTORIAL_STEPS = [
  {
    key: 'rotate',
    title: '1 · LE GRAIN DU CADRAN',
    text: 'Posez le pouce sur le bord du cadran et tracez un cercle. Chaque cran de 2° produit un micro-tic d’engrenage. Fermez les yeux : comptez les crans du bout des doigts. Faites un demi-tour complet.',
  },
  {
    key: 'find',
    title: '2 · LE TREMBLEMENT',
    text: 'Un point d’ancrage est caché. En approchant (±4°), le téléphone se met à trembler de plus en plus vite. Pile dessus : une DOUBLE impulsion lourde et feutrée + un clic sourd. Trouvez-la, yeux fermés si vous l’osez.',
  },
  {
    key: 'hold',
    title: '3 · L’IMMOBILITÉ',
    text: 'Revenez sur le point et ne bougez plus d’un millimètre pendant une seconde, le doigt posé. La jauge circulaire se remplit. Si vous tremblez, levez le doigt ou glissez : la goupille se réinitialise.',
  },
  {
    key: 'decoy',
    title: '4 · LES LEURRES',
    text: 'Deux points sont cachés. Le leurre ne donne qu’UN SEUL choc sec et métallique. S’y attarder déclenche l’alarme. Touchez le leurre, fuyez-le, puis débloquez la vraie goupille.',
  },
  {
    key: 'done',
    title: '5 · DIPLÔMÉ',
    text: 'Vous savez lire une serrure au toucher. En vrai casse : chrono, essais limités, jusqu’à 5 goupilles et plusieurs leurres. Bonne chance.',
  },
] as const;

function TutorialScreen({ settings, onFinish, onBack }: { settings: Settings; onFinish: (launch: boolean) => void; onBack: () => void }) {
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [decoyFelt, setDecoyFelt] = useState(false);
  const stepRef = useRef(step);
  stepRef.current = step;
  const decoyFeltRef = useRef(false);
  const dialSize = Math.min(width - 56, height * 0.38, 340);
  const cur = TUTORIAL_STEPS[step];

  const advance = useCallback(() => {
    HapticEngine.notify(Haptics.NotificationFeedbackType.Success);
    SoundEngine.play('reveal', 0.6);
    setFeedback('');
    setHint(false);
    setProgress(0);
    setStep((s) => Math.min(TUTORIAL_STEPS.length - 1, s + 1));
  }, []);

  const engineCfg = useMemo<EngineConfig>(
    () => ({
      pins: 99,
      decoys: 0,
      nearWindow: 4.5,
      lockWindow: 2.4,
      holdMs: cur.key === 'find' ? 9e9 : 1000,
      decoyTrapRatio: 0.7,
      sensitivity: SENSITIVITY_VALUES[settings.sensitivity],
      autoRegenerate: false,
    }),
    [cur.key, settings.sensitivity],
  );

  const engine = useLockEngine(
    engineCfg,
    {
      onAnchor: (decoy) => {
        const k = TUTORIAL_STEPS[stepRef.current].key;
        if (decoy) {
          decoyFeltRef.current = true;
          setDecoyFelt(true);
          setFeedback('Un seul choc sec : c’est un LEURRE. Partez vite !');
        } else if (k === 'find') {
          setFeedback('Double impulsion ressentie : point d’ancrage trouvé !');
          setTimeout(advance, 900);
        } else {
          setFeedback('Ancrage ! Immobile… la jauge se remplit.');
        }
      },
      onHoldBroken: (reason) =>
        setFeedback(reason === 'released' ? 'Doigt levé : la goupille retombe. Recommencez.' : 'Vous avez bougé : la goupille retombe.'),
      onPinUnlocked: () => {
        const k = TUTORIAL_STEPS[stepRef.current].key;
        if (k === 'hold') {
          setFeedback('Goupille débloquée !');
          setTimeout(advance, 900);
        } else if (k === 'decoy') {
          if (decoyFeltRef.current) {
            setFeedback('Parfait : leurre identifié et vraie goupille débloquée.');
            setTimeout(advance, 1000);
          } else {
            setFeedback('Goupille débloquée… mais trouvez aussi le leurre (un seul choc sec) !');
            engine.setZones([
              { angle: engine.freeAngle([]), kind: 'target' },
              { angle: mod(engine.reading + 120, 360), kind: 'decoy' },
            ]);
          }
        }
      },
      onTrap: () => setFeedback('ALARME ! Vous êtes resté sur un leurre. Ici, ce n’est qu’un exercice.'),
      onZonesChanged: (z) => setZones([...z]),
    },
    cur.key !== 'done',
    dialSize,
  );

  // Mise en place de chaque étape
  useEffect(() => {
    engine.reset();
    if (cur.key === 'rotate') engine.setZones([]);
    if (cur.key === 'find') engine.setZones([{ angle: mod(engine.reading + rand(70, 290), 360), kind: 'target' }]);
    if (cur.key === 'hold' && engine.zones.length === 0) engine.setZones([{ angle: mod(engine.reading + 90, 360), kind: 'target' }]);
    if (cur.key === 'decoy') {
      decoyFeltRef.current = false;
      setDecoyFelt(false);
      const a = mod(engine.reading + rand(60, 120), 360);
      engine.setZones([
        { angle: a, kind: 'decoy' },
        { angle: mod(a + rand(110, 170), 360), kind: 'target' },
      ]);
    }
    if (cur.key === 'done') {
      engine.setZones([]);
      HapticEngine.unlock();
      SoundEngine.play('coins', 0.8);
    }
  }, [cur.key, engine]);

  // Progression de l'étape 1 (rotation cumulée)
  useEffect(() => {
    if (cur.key !== 'rotate') return;
    const t = setInterval(() => {
      const p = clamp(engine.cumulative / 180, 0, 1);
      setProgress(p);
      if (p >= 1) {
        clearInterval(t);
        advance();
      }
    }, 100);
    return () => clearInterval(t);
  }, [cur.key, engine, advance]);

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.scrollPad} scrollEnabled={false}>
        <ScreenHeader title="TUTORIEL SENSORIEL" onBack={onBack} right={<Text style={styles.stepCount}>{Math.min(step + 1, 5)}/5</Text>} />
        <View style={{ flexDirection: 'row', gap: 4, marginBottom: 10 }}>
          {TUTORIAL_STEPS.map((s, i) => (
            <View key={s.key} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? C.gold : i === step ? C.cctv : C.line }} />
          ))}
        </View>
        <LinearGradient colors={['#0F1A15', '#08100C']} style={[styles.card, { borderColor: C.cctvDim }]}>
          <Text style={styles.tutoTitle}>{cur.title}</Text>
          <Text style={styles.tutoText}>{cur.text}</Text>
          {cur.key === 'rotate' ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          ) : null}
          {cur.key === 'decoy' ? (
            <Text style={[styles.tutoText, { color: decoyFelt ? C.cctv : C.textMute, marginTop: 6 }]}>
              {decoyFelt ? '✓ Leurre ressenti' : '○ Leurre pas encore ressenti'}
            </Text>
          ) : null}
          {feedback ? <Text style={styles.tutoFeedback}>{feedback}</Text> : null}
        </LinearGradient>

        {cur.key !== 'done' ? (
          <>
            <View style={{ alignItems: 'center', marginVertical: 8 }}>
              <LockDial size={dialSize} engine={engine} accent={C.cctv} markers={hint || settings.cheat ? zones : null} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <SignalScope width={width - 32 - 96} blind={false} height={52} />
              <DialReadout engine={engine} blind={false} cheat={hint || settings.cheat} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <HeistButton compact style={{ flex: 1 }} label={hint ? 'MASQUER L’INDICE' : 'INDICE VISUEL'} icon={<Icon name="eye" size={18} />} onPress={() => setHint((h) => !h)} />
              <HeistButton compact style={{ flex: 1 }} label="PASSER L’ÉTAPE" variant="ghost" onPress={advance} />
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: 16, marginTop: 10 }}>
            <View style={styles.diploma}>
              <LogoMark size={120} />
              <Text style={styles.diplomaTitle}>CROCHETEUR CERTIFIÉ</Text>
              <Text style={styles.diplomaSub}>Délivré par la Guilde des Doigts de Velours</Text>
            </View>
            <HeistButton style={{ alignSelf: 'stretch' }} label="LANCER MON PREMIER CASSE" variant="gold" icon={<Icon name="dial" size={26} color="#2A1A04" />} onPress={() => onFinish(true)} />
            <HeistButton style={{ alignSelf: 'stretch' }} label="RETOUR AU QG" onPress={() => onFinish(false)} />
          </View>
        )}
      </ScrollView>
      <SimulatorFlash enabled={settings.simulator} />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 23. ÉCRAN : PARAMÈTRES
 * ════════════════════════════════════════════════════════════════════════ */

function ToggleRow({ label, sub, value, onChange, accent = C.gold }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; accent?: string }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: value ? 1 : 0, friction: 7, tension: 120, useNativeDriver: false }).start();
  }, [value, anim]);
  return (
    <Pressable
      style={styles.settingRow}
      onPress={() => {
        HapticEngine.ui();
        SoundEngine.play('ui', 0.5);
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sub ? <Text style={styles.settingSub}>{sub}</Text> : null}
      </View>
      <Animated.View style={[styles.switchTrack, { backgroundColor: anim.interpolate({ inputRange: [0, 1], outputRange: ['#1A1D23', accent + '55'] }), borderColor: value ? accent : C.lineHi }]}>
        <Animated.View
          style={[
            styles.switchKnob,
            { backgroundColor: value ? accent : C.steelMid, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [2, 24] }) }] },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

function Segmented<T extends number>({ label, sub, options, value, onChange }: { label: string; sub?: string; options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={[styles.settingRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
      <Text style={styles.settingLabel}>{label}</Text>
      {sub ? <Text style={styles.settingSub}>{sub}</Text> : null}
      <View style={styles.segment}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.label}
              style={[styles.segmentItem, on && { backgroundColor: C.gold }]}
              onPress={() => {
                HapticEngine.ui();
                onChange(o.value);
              }}
            >
              <Text style={[styles.segmentText, on && { color: '#1A1206' }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SettingsScreen({
  career,
  onChange,
  onReset,
  onBack,
}: {
  career: Career;
  onChange: (s: Partial<Settings>) => void;
  onReset: () => void;
  onBack: () => void;
}) {
  const s = career.settings;
  const tests: { label: string; fn: () => void }[] = [
    { label: 'TIC', fn: () => HapticEngine.tick() },
    { label: 'TREMBLEMENT', fn: () => [0, 90, 170, 240, 300, 350, 395].forEach((ms, i) => setTimeout(() => HapticEngine.tremor(i / 6), ms)) },
    {
      label: 'ANCRAGE',
      fn: () => {
        HapticEngine.anchor();
        SoundEngine.play('anchor');
      },
    },
    {
      label: 'LEURRE',
      fn: () => {
        HapticEngine.decoy();
        SoundEngine.play('decoy');
      },
    },
    {
      label: 'DÉBLOCAGE',
      fn: () => {
        HapticEngine.unlock();
        SoundEngine.play('unlock');
      },
    },
    {
      label: 'ALARME',
      fn: () => {
        HapticEngine.alarm(6);
        SoundEngine.play('error');
      },
    },
  ];
  return (
    <ScrollView contentContainerStyle={styles.scrollPad}>
      <ScreenHeader title="PARAMÈTRES" onBack={onBack} />
      <Text style={styles.sectionTitle}>SENSATIONS</Text>
      <View style={styles.card}>
        <ToggleRow label="Retour haptique" sub="Le cœur du jeu : à laisser activé" value={s.haptics} onChange={(v) => onChange({ haptics: v })} />
        <Segmented
          label="Puissance haptique"
          options={[
            { label: 'DOUCE', value: 0 as 0 | 1 | 2 },
            { label: 'NORMALE', value: 1 as 0 | 1 | 2 },
            { label: 'FORTE', value: 2 as 0 | 1 | 2 },
          ]}
          value={s.hapticPower}
          onChange={(v) => onChange({ hapticPower: v })}
        />
        <Segmented
          label="Sensibilité du cadran"
          sub="FINE = rotation démultipliée, plus précise"
          options={[
            { label: 'FINE', value: 0 as 0 | 1 | 2 },
            { label: 'NORMALE', value: 1 as 0 | 1 | 2 },
            { label: 'RAPIDE', value: 2 as 0 | 1 | 2 },
          ]}
          value={s.sensitivity}
          onChange={(v) => onChange({ sensitivity: v })}
        />
        <Text style={[styles.settingSub, { marginTop: 8 }]}>BANC D’ESSAI HAPTIQUE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {tests.map((t) => (
            <Pressable key={t.label} style={styles.chip} onPress={t.fn}>
              <Text style={[styles.chipText, { color: C.gold }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>AMBIANCE SONORE</Text>
      <View style={styles.card}>
        <ToggleRow label="Effets sonores" sub="Clics, pênes, sirène — synthétisés en direct" value={s.sound} onChange={(v) => onChange({ sound: v })} />
        <ToggleRow label="Ambiance de la salle des coffres" sub="Bourdonnement de ventilation en boucle" value={s.ambience} onChange={(v) => onChange({ ambience: v })} />
      </View>

      <Text style={styles.sectionTitle}>DÉFI & TEST</Text>
      <View style={styles.card}>
        <ToggleRow label="Mode Aveugle" sub="Angle et oscilloscope masqués · butin ×1,5" value={s.blind} onChange={(v) => onChange({ blind: v })} />
        <ToggleRow
          label="Simulateur haptique visuel"
          sub="Flash de bordure à chaque vibration (émulateur, tablette sans moteur haptique)"
          value={s.simulator}
          accent={C.cctv}
          onChange={(v) => onChange({ simulator: v })}
        />
        <ToggleRow
          label="Mode triche (développeur)"
          sub="Affiche cibles & leurres, tolérance élargie, choix du niveau au briefing"
          value={s.cheat}
          accent={C.red}
          onChange={(v) => onChange({ cheat: v })}
        />
      </View>

      <Text style={styles.sectionTitle}>CARRIÈRE</Text>
      <View style={styles.card}>
        {[
          ['Casses réussis', `${career.heists}`],
          ['Arrestations', `${career.failures}`],
          ['Goupilles crochetées', `${career.pinsCracked}`],
          ['Leurres déclenchés', `${career.trapsTriggered}`],
          ['Meilleur temps', career.bestTimeMs ? formatClock(career.bestTimeMs) : '—'],
          ['Carrière débutée le', formatDate(career.createdAt)],
        ].map(([k, v]) => (
          <View key={k} style={styles.dossierRow}>
            <Text style={styles.dossierKey}>{k.toUpperCase()}</Text>
            <Text style={styles.dossierVal}>{v}</Text>
          </View>
        ))}
        <HeistButton
          style={{ marginTop: 12 }}
          compact
          variant="red"
          label="EFFACER TOUTES LES DONNÉES"
          onPress={() =>
            Alert.alert('Brûler le dossier ?', 'Toute la carrière et le butin seront définitivement effacés de cet appareil.', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Effacer', style: 'destructive', onPress: onReset },
            ])
          }
        />
      </View>

      <View style={[styles.card, { flexDirection: 'row', gap: 14, alignItems: 'center' }]}>
        <AppIcon size={64} />
        <View style={{ flex: 1 }}>
          <Text style={styles.footerTitle}>HAPTIC HEIST · v1.0</Text>
          <Text style={styles.settingSub}>
            Confidentialité absolue : aucune connexion réseau, aucun compte, aucun traceur, aucune publicité, aucun achat. Toutes les données restent sur cet appareil.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 24. BARRE D'ONGLETS PERSONNALISÉE & TRANSITIONS
 * ════════════════════════════════════════════════════════════════════════ */

function TabBar({ current, onSelect, bottom }: { current: TabName; onSelect: (t: TabName) => void; bottom: number }) {
  const tabs: { key: TabName; label: string; icon: string }[] = [
    { key: 'menu', label: 'QG', icon: 'dial' },
    { key: 'vault', label: 'BUTIN', icon: 'vault' },
    { key: 'tutorial', label: 'TUTO', icon: 'finger' },
    { key: 'settings', label: 'RÉGLAGES', icon: 'gear' },
  ];
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(bottom, 8) }]}>
      <LinearGradient colors={['#0D0F13', '#050608']} style={StyleSheet.absoluteFill} />
      <View style={styles.tabBarLine} />
      {tabs.map((t) => {
        const on = t.key === current;
        return (
          <Pressable
            key={t.key}
            style={styles.tabItem}
            onPress={() => {
              if (on) return;
              HapticEngine.ui();
              SoundEngine.play('ui', 0.5);
              onSelect(t.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <View style={[styles.tabIndicator, on && { backgroundColor: C.gold }]} />
            <Icon name={t.icon} size={22} color={on ? C.gold : C.textMute} />
            <Text style={[styles.tabLabel, on && { color: C.gold }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ScreenFade({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View style={[styles.fill, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>{children}</Animated.View>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 25. RACINE DE L'APPLICATION
 * ════════════════════════════════════════════════════════════════════════ */

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={[styles.fill, { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.black }]}>
          <Text style={[styles.bustedTitle, { fontSize: 32 }]}>COURT-CIRCUIT</Text>
          <Text style={[styles.tutoText, { textAlign: 'center', marginTop: 12 }]}>{this.state.error.message}</Text>
          <HeistButton style={{ marginTop: 20, alignSelf: 'stretch' }} label="REDÉMARRER" variant="gold" onPress={() => this.setState({ error: null })} />
        </View>
      );
    }
    return this.props.children;
  }
}

function HapticHeistApp() {
  const insets = useSafeAreaInsets();
  const [career, setCareer] = useState<Career | null>(null);
  const [booted, setBooted] = useState(false);
  const [screen, setScreen] = useState<ScreenName>('menu');
  const [heistLevel, setHeistLevel] = useState(1);
  const [heistKey, setHeistKey] = useState(0);
  const [lastResult, setLastResult] = useState<HeistResult | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const careerRef = useRef<Career | null>(null);
  careerRef.current = career;

  // Chargement de la carrière + démarrage audio
  useEffect(() => {
    let alive = true;
    const minSplash = new Promise((r) => setTimeout(r, 1300));
    void (async () => {
      const c = await loadCareer();
      if (!alive) return;
      HapticEngine.configure(c.settings);
      SoundEngine.configure(c.settings);
      setCareer(c);
      setHeistLevel(c.level);
      await minSplash;
      if (alive) setBooted(true);
    })();
    setTimeout(() => void SoundEngine.init(), 50);
    return () => {
      alive = false;
    };
  }, []);

  // Sauvegarde immédiate quand l'app passe en arrière-plan
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') SoundEngine.resumeAll();
      else {
        void CareerWriter.flush();
        SoundEngine.pauseAll();
      }
    });
    return () => sub.remove();
  }, []);

  // Ambiance sonore hors écrans d'alerte
  useEffect(() => {
    if (!career) return;
    if (screen === 'gameover' || !career.settings.ambience || !career.settings.sound) SoundEngine.stopLoop('ambience');
    else SoundEngine.startLoop('ambience', screen === 'heist' ? 0.55 : 0.4);
  }, [screen, career]);

  // Bouton retour Android hors partie
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'heist') return true;
      if (screen !== 'menu') {
        SoundEngine.stopLoop('siren');
        setScreen('menu');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen]);

  const updateCareer = useCallback((fn: (c: Career) => Career) => {
    const prev = careerRef.current;
    if (!prev) return;
    const next = fn(prev);
    careerRef.current = next;
    setCareer(next);
    CareerWriter.schedule(next);
  }, []);

  const navigate = useCallback(
    (s: ScreenName) => {
      SoundEngine.stopLoop('siren');
      if (s === 'briefing' && careerRef.current) setHeistLevel(careerRef.current.level);
      if (s !== 'vault') setHighlightId(null);
      setScreen(s);
    },
    [],
  );

  const startHeist = useCallback(() => {
    SoundEngine.stopLoop('siren');
    setHeistKey((k) => k + 1);
    setScreen('heist');
  }, []);

  const onHeistSuccess = useCallback(
    (r: Omit<HeistResult, 'loot'>) => {
      const c = careerRef.current;
      if (!c) return;
      const cfg = getHeistConfig(r.level);
      const loot = generateLoot(cfg, c.settings.blind);
      const full: HeistResult = { ...r, loot };
      updateCareer((prev) => ({
        ...prev,
        heists: prev.heists + 1,
        totalLoot: prev.totalLoot + loot.value,
        loot: [loot, ...prev.loot].slice(0, MAX_LOOT_ITEMS),
        level: Math.max(prev.level, r.level + 1),
        bestTimeMs: prev.bestTimeMs === 0 ? r.timeMs : Math.min(prev.bestTimeMs, r.timeMs),
        pinsCracked: prev.pinsCracked + r.pinsDone,
        trapsTriggered: prev.trapsTriggered + r.traps,
      }));
      void CareerWriter.flush();
      setLastResult(full);
      setScreen('success');
    },
    [updateCareer],
  );

  const onHeistFail = useCallback(
    (r: HeistResult) => {
      updateCareer((prev) => ({
        ...prev,
        failures: prev.failures + 1,
        pinsCracked: prev.pinsCracked + r.pinsDone,
        trapsTriggered: prev.trapsTriggered + r.traps,
      }));
      void CareerWriter.flush();
      setLastResult(r);
      setScreen('gameover');
    },
    [updateCareer],
  );

  const changeSettings = useCallback(
    (patch: Partial<Settings>) => {
      updateCareer((prev) => {
        const settings = { ...prev.settings, ...patch };
        HapticEngine.configure(settings);
        SoundEngine.configure(settings);
        return { ...prev, settings };
      });
    },
    [updateCareer],
  );

  const resetCareer = useCallback(async () => {
    await CareerWriter.wipe();
    const fresh = defaultCareer();
    fresh.settings = careerRef.current ? { ...careerRef.current.settings } : fresh.settings;
    careerRef.current = fresh;
    setCareer(fresh);
    setHeistLevel(1);
    CareerWriter.schedule(fresh);
    HapticEngine.error();
  }, []);

  if (!booted || !career) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SplashScreen />
      </View>
    );
  }

  const tabScreens: ScreenName[] = ['menu', 'vault', 'tutorial', 'settings'];
  const showTabs = tabScreens.includes(screen);
  const cfg = getHeistConfig(heistLevel);

  let content: React.ReactNode = null;
  switch (screen) {
    case 'menu':
      content = <MenuScreen career={career} onNavigate={navigate} />;
      break;
    case 'briefing':
      content = <BriefingScreen career={career} level={heistLevel} onLevelChange={setHeistLevel} onStart={startHeist} onBack={() => navigate('menu')} />;
      break;
    case 'heist':
      content = (
        <HeistScreen
          key={heistKey}
          cfg={cfg}
          settings={career.settings}
          onSuccess={onHeistSuccess}
          onFail={onHeistFail}
          onAbort={() => navigate('menu')}
        />
      );
      break;
    case 'success':
      content = lastResult?.loot ? (
        <SuccessScreen
          result={lastResult}
          onTakeLoot={() => {
            setHighlightId(lastResult.loot?.id ?? null);
            setScreen('vault');
          }}
          onNext={() => {
            setHeistLevel(lastResult.level + 1);
            setScreen('briefing');
          }}
        />
      ) : null;
      break;
    case 'gameover':
      content = lastResult ? (
        <GameOverScreen
          result={lastResult}
          onRetry={() => {
            setHeistLevel(lastResult.level);
            startHeist();
          }}
          onEscape={() => navigate('menu')}
        />
      ) : null;
      break;
    case 'vault':
      content = <VaultScreen career={career} highlightId={highlightId} onBack={() => navigate('menu')} />;
      break;
    case 'tutorial':
      content = (
        <TutorialScreen
          settings={career.settings}
          onBack={() => navigate('menu')}
          onFinish={(launch) => {
            updateCareer((p) => ({ ...p, tutorialDone: true }));
            navigate(launch ? 'briefing' : 'menu');
          }}
        />
      );
      break;
    case 'settings':
      content = <SettingsScreen career={career} onChange={changeSettings} onReset={() => void resetCareer()} onBack={() => navigate('menu')} />;
      break;
  }

  const immersive = screen === 'heist' || screen === 'success' || screen === 'gameover';

  return (
    <View style={styles.root}>
      <StatusBar style="light" hidden={screen === 'heist'} />
      {!immersive ? <MetalBackdrop /> : null}
      <View style={[styles.fill, !immersive && { paddingTop: insets.top }]}>
        <ScreenFade key={screen === 'heist' ? `heist-${heistKey}` : screen}>{content}</ScreenFade>
      </View>
      {showTabs ? <TabBar current={screen as TabName} onSelect={(t) => navigate(t)} bottom={insets.bottom} /> : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <HapticHeistApp />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 26. FEUILLE DE STYLES
 * ════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.black },
  fill: { flex: 1 },
  scrollPad: { padding: 16, paddingBottom: 40, gap: 14 },

  logoTagline: { color: C.textDim, fontFamily: MONO, fontSize: 10, letterSpacing: 3, marginTop: 2 },
  bootLine: { color: C.cctvDim, fontFamily: MONO, fontSize: 11, marginTop: 4, letterSpacing: 0.5 },

  cctv: { alignItems: 'flex-end' },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, marginRight: 6 },
  cctvText: { color: C.cctv, fontFamily: MONO, fontSize: 11, letterSpacing: 1 },
  cctvTextDim: { color: C.cctvDim, fontFamily: MONO, fontSize: 9, marginTop: 2 },

  btn: {
    minHeight: 66,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  btnCompact: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  btnSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.05)' },
  btnIcon: { width: 40, alignItems: 'center', marginRight: 12 },
  btnLabel: { fontFamily: DISPLAY, fontSize: 19, fontWeight: '900', letterSpacing: 2 },
  btnSub: { fontSize: 11, marginTop: 2, letterSpacing: 0.3 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  statCard: { flexGrow: 1, flexBasis: '46%', borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 12 },
  statLabel: { color: C.textDim, fontFamily: MONO, fontSize: 9, letterSpacing: 1.5 },
  statSub: { color: C.textMute, fontFamily: MONO, fontSize: 9, letterSpacing: 1, marginTop: 2 },
  statValue: { fontFamily: DISPLAY, fontSize: 22, fontWeight: '900', marginTop: 6, letterSpacing: 1 },

  tickerWrap: { marginTop: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.cctvDeep, paddingVertical: 6, overflow: 'hidden', backgroundColor: 'rgba(6,38,26,0.35)' },
  tickerText: { color: C.cctv, fontFamily: MONO, fontSize: 10, letterSpacing: 1.5 },
  footerTitle: { color: C.text, fontFamily: DISPLAY, fontSize: 14, fontWeight: '900', letterSpacing: 3 },
  footerSub: { color: C.textMute, fontSize: 10, marginTop: 2 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: C.lineHi, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0D11' },
  headerTitle: { color: C.text, fontFamily: DISPLAY, fontSize: 18, fontWeight: '900', letterSpacing: 3 },

  card: { borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 16, backgroundColor: 'rgba(11,13,17,0.85)', overflow: 'hidden' },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 12 },
  dossierType: { fontFamily: MONO, fontSize: 11, letterSpacing: 2 },
  dossierName: { color: C.text, fontFamily: DISPLAY, fontSize: 28, fontWeight: '900', marginTop: 4, letterSpacing: 1 },
  dossierCity: { color: C.textDim, fontSize: 13, marginTop: 4 },
  dossierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: 12 },
  dossierKey: { color: C.textDim, fontFamily: MONO, fontSize: 11, letterSpacing: 1 },
  dossierVal: { color: C.text, fontFamily: MONO, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  dossierNote: { color: C.textDim, fontSize: 12, lineHeight: 18, marginTop: 4 },

  heistTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  heistTier: { fontFamily: MONO, fontSize: 10, letterSpacing: 2 },
  heistName: { color: C.text, fontFamily: DISPLAY, fontSize: 17, fontWeight: '900', letterSpacing: 1 },
  hudRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, marginTop: 12, gap: 10 },
  hudLabel: { color: C.textDim, fontFamily: MONO, fontSize: 9, letterSpacing: 2 },
  chrono: { fontFamily: MONO, fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  pinLabel: { color: C.textMute, fontFamily: MONO, fontSize: 9, marginTop: 3 },
  statusLine: { textAlign: 'center', fontFamily: MONO, fontSize: 13, letterSpacing: 1.5, marginTop: 10, paddingHorizontal: 16 },
  heistHint: { color: C.textMute, textAlign: 'center', fontSize: 10, marginTop: 6, letterSpacing: 0.5 },

  scope: { borderRadius: 8, borderWidth: 1, borderColor: C.cctvDim, backgroundColor: 'rgba(3,18,11,0.85)', overflow: 'hidden' },
  scopeLegend: { position: 'absolute', top: 3, left: 6, flexDirection: 'row', gap: 10 },
  scopeText: { fontFamily: MONO, fontSize: 8, letterSpacing: 1 },
  readout: { width: 86, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: C.lineHi, backgroundColor: '#07080A', paddingVertical: 6 },
  readoutLabel: { color: C.textDim, fontFamily: MONO, fontSize: 8, letterSpacing: 1.5 },
  readoutValue: { color: C.gold, fontFamily: MONO, fontSize: 22, fontWeight: '700', marginTop: 2 },

  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center' },
  overlayKicker: { color: C.cctv, fontFamily: MONO, fontSize: 12, letterSpacing: 4 },
  countdown: { color: C.gold, fontFamily: DISPLAY, fontSize: 110, fontWeight: '900', letterSpacing: 4 },
  overlaySub: { color: C.textDim, fontFamily: MONO, fontSize: 12, letterSpacing: 1 },

  alarmOffBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: C.cctvDim, backgroundColor: 'rgba(6,38,26,0.6)' },
  alarmOffText: { color: C.cctv, fontFamily: MONO, fontSize: 10, letterSpacing: 1.2 },
  vaultFrame: { alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: '#2A2F38', overflow: 'hidden' },
  rarityBadge: { fontFamily: MONO, fontSize: 11, letterSpacing: 3, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' },
  lootName: { color: C.text, fontFamily: DISPLAY, fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 10, letterSpacing: 0.5 },
  lootValue: { color: C.gold, fontFamily: MONO, fontSize: 28, fontWeight: '700', marginTop: 6 },
  lootMeta: { color: C.textDim, fontSize: 11, marginTop: 6, textAlign: 'center' },

  bustedTitle: { color: C.red, fontFamily: DISPLAY, fontSize: 64, fontWeight: '900', letterSpacing: 10, textShadowColor: C.red, textShadowRadius: 18 },
  bustedSub: { color: C.textDim, fontFamily: MONO, fontSize: 11, letterSpacing: 2 },

  lootCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 12, overflow: 'hidden' },
  lootIconWrap: { width: 64, height: 64, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050608' },
  lootCardRarity: { fontFamily: MONO, fontSize: 9, letterSpacing: 2 },
  lootCardName: { color: C.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  lootCardValue: { color: C.gold, fontFamily: MONO, fontSize: 14, fontWeight: '700', marginTop: 3 },
  lootCardMeta: { color: C.textDim, fontSize: 11, marginTop: 6, lineHeight: 16 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.5 },
  emptyText: { color: C.textDim, fontSize: 14, textAlign: 'center', paddingHorizontal: 30 },

  stepCount: { color: C.cctv, fontFamily: MONO, fontSize: 13 },
  tutoTitle: { color: C.cctv, fontFamily: DISPLAY, fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  tutoText: { color: C.text, fontSize: 13, lineHeight: 19, marginTop: 6 },
  tutoFeedback: { color: C.gold, fontFamily: MONO, fontSize: 12, marginTop: 10 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#0A1510', marginTop: 12, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: C.cctv },
  diploma: { alignItems: 'center', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: C.gold + '88', backgroundColor: 'rgba(30,22,8,0.6)', alignSelf: 'stretch' },
  diplomaTitle: { color: C.gold, fontFamily: DISPLAY, fontSize: 22, fontWeight: '900', letterSpacing: 3, marginTop: 10 },
  diplomaSub: { color: C.textDim, fontSize: 11, marginTop: 4 },

  sectionTitle: { color: C.textDim, fontFamily: MONO, fontSize: 10, letterSpacing: 3, marginTop: 6 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  settingLabel: { color: C.text, fontSize: 15, fontWeight: '600' },
  settingSub: { color: C.textMute, fontSize: 11, marginTop: 2, lineHeight: 15 },
  switchTrack: { width: 50, height: 28, borderRadius: 14, borderWidth: 1, justifyContent: 'center' },
  switchKnob: { width: 22, height: 22, borderRadius: 11 },
  segment: { flexDirection: 'row', marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: C.lineHi, overflow: 'hidden' },
  segmentItem: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  segmentText: { color: C.textDim, fontFamily: MONO, fontSize: 11, letterSpacing: 1 },

  tabBar: { flexDirection: 'row', paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line, overflow: 'hidden' },
  tabBarLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: C.gold, opacity: 0.25 },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabIndicator: { width: 22, height: 3, borderRadius: 2, backgroundColor: 'transparent', marginBottom: 3 },
  tabLabel: { color: C.textMute, fontFamily: MONO, fontSize: 9, letterSpacing: 1.5 },
});
