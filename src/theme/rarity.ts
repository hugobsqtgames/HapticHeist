import type { Rarity } from '@/types/game';

import { C } from './colors';

export const RARITY_META: Record<Rarity, { label: string; color: string; mult: number }> = {
  commun: { label: 'Commun', color: '#8E8E93', mult: 1 },
  rare: { label: 'Rare', color: C.blue, mult: 2.2 },
  epique: { label: 'Épique', color: C.purple, mult: 4.5 },
  legendaire: { label: 'Légendaire', color: C.gold, mult: 10 },
};

export const RARITY_ORDER: readonly Rarity[] = ['legendaire', 'epique', 'rare', 'commun'];
