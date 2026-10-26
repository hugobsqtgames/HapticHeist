/**
 * Career save files injected into the app before each capture.
 * Loot is produced by the app's real generator (src/game/content.ts).
 */
const { seedRandom } = require('./ts-loader.cjs');
const { generateLoot, getHeistConfig } = require('@/game/content');
const { STORAGE_KEY, defaultCareer } = require('@/storage/career');

const DAY = 86400000;
const NOW = Date.parse('2026-10-20T19:30:00Z');

/** A career where heists 1…(level-1) have all been cracked. */
function careerAt(level, { failures = 0, seed = 1, times = [] } = {}) {
  seedRandom(seed);
  const c = defaultCareer();
  c.createdAt = NOW - 21 * DAY;
  c.level = level;
  c.tutorialDone = true;
  c.failures = failures;
  for (let l = 1; l < level; l++) {
    const cfg = getHeistConfig(l);
    const item = generateLoot(cfg, false);
    item.id = `seed-${l}`;
    item.date = NOW - (level - l) * 2 * DAY - l * 3600000;
    c.loot.unshift(item);
    c.heists += 1;
    c.totalLoot += item.value;
    c.pinsCracked += cfg.pins;
  }
  c.trapsTriggered = Math.max(0, level - 3);
  c.bestTimeMs = times[0] ?? (level > 1 ? 19800 : 0);
  return c;
}

const CAREERS = {
  /** Hero sequence: next target is level 2 (Bijouterie, gold accent, 1 pin, timer). */
  hero: careerAt(2, { seed: 7 }),
  /** Decoy sequence: level 3 (Banque, 2 pins, 1 decoy). */
  decoy: careerAt(3, { seed: 11 }),
  /** "Later on": a fuller vault for the collection shot. */
  veteran: careerAt(8, { failures: 2, seed: 23, times: [16400] }),
};

module.exports = { CAREERS, STORAGE_KEY };

if (require.main === module) {
  for (const [k, c] of Object.entries(CAREERS)) {
    console.log(`\n# ${k}: level ${c.level}, ${c.heists} heists, ${c.totalLoot} $`);
    c.loot.forEach((l) => console.log(`  ${l.rarity.padEnd(10)} ${String(l.value).padStart(10)}  ${l.name}`));
  }
}
