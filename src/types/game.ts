

export type Rarity = 'commun' | 'rare' | 'epique' | 'legendaire';
export type LootKind =
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

export interface LootItem {
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

export interface Settings {
  haptics: boolean;
  sound: boolean;
  ambience: boolean;
  hapticPower: 0 | 1 | 2;
  sensitivity: 0 | 1 | 2;
  blind: boolean;
  cheat: boolean;
  simulator: boolean;
}

export interface Career {
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

export interface Tier {
  name: string;
  type: string;
  city: string;
  safe: string;
  mult: number;
  accent: string;
  fromLevel: number;
}

export interface HeistConfig {
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

export interface HeistResult {
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

export type ZoneKind = 'target' | 'decoy';
export interface Zone {
  id: number;
  angle: number;
  kind: ZoneKind;
}
