import { C } from '@/theme/colors';
import { RARITY_META } from '@/theme/rarity';
import type { HeistConfig, LootItem, LootKind, Rarity, Tier } from '@/types/game';
import { clamp, pick, rand, uid } from '@/utils/math';

export const TIERS: readonly Tier[] = [
  { name: 'Bijouterie Valmont', type: 'Bijouterie', city: 'Genève', safe: 'Coffret Valmont V-200', mult: 1, accent: C.gold, fromLevel: 1 },
  { name: 'Banque Sterling & Fils', type: 'Banque', city: 'Zurich', safe: 'Chambre forte S-9', mult: 1.7, accent: C.blue, fromLevel: 3 },
  { name: 'Manoir Ravencourt', type: 'Manoir', city: 'Cornouailles', safe: 'Coffre mural victorien', mult: 2.6, accent: C.purple, fromLevel: 5 },
  { name: "Musée d'Orsenne", type: 'Musée', city: 'Paris', safe: 'Réserve climatisée M-4', mult: 3.8, accent: C.green, fromLevel: 7 },
  { name: 'Réserve Obsidienne', type: 'Réserve fédérale', city: 'Lieu classifié', safe: 'Caveau Obsidienne Ω', mult: 5.5, accent: C.red, fromLevel: 9 },
];

export const tierForLevel = (level: number): Tier => {
  let t = TIERS[0];
  for (const tier of TIERS) if (level >= tier.fromLevel) t = tier;
  return t;
};

export function getHeistConfig(level: number): HeistConfig {
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

export const LOOT_BASES: readonly { kind: LootKind; noun: string; g: 'm' | 'f'; plural?: boolean; vowel?: boolean; base: number; hue: string }[] = [
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

export const ADJECTIVES: readonly { m: string; f: string; mp: string }[] = [
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

export const ORIGINS: readonly string[] = [
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

export function rollRarity(level: number): Rarity {
  const r = Math.random();
  const leg = 0.02 + level * 0.012;
  const epi = 0.08 + level * 0.02;
  const rar = 0.25 + level * 0.02;
  if (r < leg) return 'legendaire';
  if (r < leg + epi) return 'epique';
  if (r < leg + epi + rar) return 'rare';
  return 'commun';
}

export function generateLoot(cfg: HeistConfig, blind: boolean): LootItem {
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
