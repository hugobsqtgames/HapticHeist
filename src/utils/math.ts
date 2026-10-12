

export const TAU = Math.PI * 2;
export const mod = (a: number, n: number) => ((a % n) + n) % n;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const circDist = (a: number, b: number) => {
  const d = Math.abs(mod(a, 360) - mod(b, 360));
  return d > 180 ? 360 - d : d;
};
/** Coordonnées polaires : angle en degrés, 0 = haut, sens horaire. */
export const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
};
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

/** Générateur pseudo-aléatoire déterministe (pour la synthèse sonore). */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
