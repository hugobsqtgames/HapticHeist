import AsyncStorage from '@react-native-async-storage/async-storage';

import { C } from '@/theme/colors';
import type { Career, LootItem, LootKind, Rarity, Settings } from '@/types/game';
import { clamp, uid } from '@/utils/math';

export const STORAGE_KEY = '@hapticheist/career/v1';
export const BACKUP_KEY = '@hapticheist/career/v1:backup';
export const SCHEMA_VERSION = 1;
export const MAX_LOOT_ITEMS = 600;

export const DEFAULT_SETTINGS: Settings = {
  haptics: true,
  sound: true,
  ambience: true,
  hapticPower: 1,
  sensitivity: 1,
  blind: false,
  cheat: false,
  simulator: false,
};

export const defaultCareer = (): Career => ({
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

export const memoryStore = new Map<string, string>();

export const SafeStore = {
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

export const num = (v: unknown, fallback: number, lo = -Infinity, hi = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
export const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
export const str = (v: unknown, fallback: string, maxLen = 120) => (typeof v === 'string' ? v.slice(0, maxLen) : fallback);
export const oneOf = <T extends string | number>(v: unknown, list: readonly T[], fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

export const LOOT_KINDS: readonly LootKind[] = [
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
export const RARITIES: readonly Rarity[] = ['commun', 'rare', 'epique', 'legendaire'];

export function sanitizeLoot(raw: unknown): LootItem | null {
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

export function sanitizeCareer(raw: unknown): Career | null {
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

export async function loadCareer(): Promise<Career> {
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
export const CareerWriter = {
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
