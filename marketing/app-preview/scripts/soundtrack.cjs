/**
 * Bande-son de l'App Store Preview → .cache/audio/soundtrack.wav (48 kHz, stéréo).
 *
 * - Effets : les VRAIS sons de l'app (src/engine/audio/synth.ts), placés aux instants
 *   exacts des événements capturés (tics du cadran, ancrage, ouverture, leurre…).
 * - Musique : une nappe sobre synthétisée ici, dont les accords suivent le récit.
 */
const fs = require('fs');
const path = require('path');
require('./ts-loader.cjs');
const { SOUND_DEFS, SR: APP_SR } = require('@/engine/audio/synth');

const ROOT = path.resolve(__dirname, '..');
const SR = 48000;
const TAU = Math.PI * 2;

(async () => {
  const TL = await import(path.join(ROOT, 'timeline.mjs'));
  const clips = JSON.parse(fs.readFileSync(path.join(ROOT, '.cache/clips/clips.json'), 'utf8'));
  const { ev } = TL.resolve(clips);
  const N = Math.ceil(TL.DURATION * SR);
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  /* ───────── Effets : sons de l'app ───────── */
  const cache = {};
  const sound = (name) => {
    if (!cache[name]) {
      const src = SOUND_DEFS[name].gen();
      const out = new Float32Array(Math.floor((src.length * SR) / APP_SR));
      for (let i = 0; i < out.length; i++) {
        const x = (i * APP_SR) / SR;
        const i0 = Math.floor(x);
        const f = x - i0;
        out[i] = (src[i0] || 0) * (1 - f) + (src[i0 + 1] || 0) * f;
      }
      cache[name] = out;
    }
    return cache[name];
  };
  const place = (name, t, gain = 1, pan = 0, loopUntil = null) => {
    if (t == null || t < 0) return;
    const s = sound(name);
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    const start = Math.floor(t * SR);
    const end = loopUntil ? Math.min(N, Math.floor(loopUntil * SR)) : Math.min(N, start + s.length);
    const fadeN = loopUntil ? Math.floor(0.35 * SR) : 0;
    for (let i = start; i < end; i++) {
      const fade = fadeN && end - i < fadeN ? (end - i) / fadeN : 1;
      const v = s[(i - start) % s.length] * fade;
      L[i] += v * gl;
      R[i] += v * gr;
    }
  };

  /** Temps vidéo d'un événement de capture, via la correspondance de son plan. */
  const at = (clip, frame) => {
    for (const seg of TL.SCREENS.main) {
      if (seg.clip !== clip) continue;
      const t = TL.videoTimeOf(seg.map, frame, seg.t0, seg.t1 - 1e-3);
      if (t != null && seg.map(t) === frame) return t;
    }
    return null;
  };
  const events = (clip, type) => clips[clip].events.filter((e) => e.type === type);

  // Accroche : un cadran qu'on tourne dans le noir, puis la double impulsion.
  [0.42, 0.61, 0.77, 0.9, 1.04, 1.21, 1.43, 1.62, 1.86, 2.05].forEach((t, i) => place('tick', t, 0.32 + i * 0.01, (i % 2 ? 0.12 : -0.12)));
  place('anchor', 2.42, 0.95);
  place('anchor', 2.55, 0.55);

  // Appuis à l'écran et compte à rebours (3 clics de l'app).
  for (const e of events('hero', 'tap')) place('ui', at('hero', e.frame), 0.7);
  const go = events('hero', 'heist:go')[0].frame;
  for (const k of [63, 42, 21]) place('ui', at('hero', go - k), 0.75);

  // Tics du cadran, à chaque cran franchi (même limitation que l'app : 32 ms).
  let lastTick = -1;
  for (const clip of ['hero', 'decoy']) {
    for (const e of events(clip, 'tick')) {
      const t = at(clip, e.frame);
      if (t == null || t - lastTick < 0.032) continue;
      lastTick = t;
      place('tick', t, 0.42, Math.sin(t * 7) * 0.25);
    }
  }

  // Le casse : ancrage, maintien, ouverture.
  place('anchor', ev.heroAnchor, 1);
  place('unlock', ev.heroUnlock, 1);
  place('bolt', ev.heroUnlock + 0.1, 0.8);
  place('bolt', ev.heroUnlock + 0.32, 0.8);
  // Révélation : le calendrier sonore exact de SuccessScreen.
  const S = ev.heroSuccess;
  [0, 0.18, 0.36, 0.54].forEach((d) => place('bolt', S + d, 0.95));
  place('alarmOff', S + 0.9, 0.8);
  place('hiss', S + 1.5, 0.75);
  place('reveal', S + 2.35, 0.9);
  place('coins', S + 2.35, 0.85);

  // Les leurres : choc sec, puis l'alarme ; la sirène de l'arrestation.
  place('decoy', ev.decoyAnchor, 1);
  place('error', ev.decoyTrap, 0.9);
  place('siren', 22.1, 0.2, 0, 24.55);

  // Carrière, promesse, signature.
  place('reveal', 24.55, 0.55);
  place('anchor', TL.END_CARD.ringsAt, 0.95);
  place('anchor', TL.END_CARD.ringsAt + 0.13, 0.6);
  place('reveal', TL.END_CARD.in + 0.05, 0.75);

  /* ───────── Musique ───────── */
  const env = (t, t0, t1, a = 0.8, r = 1.2) => {
    if (t < t0 || t > t1 + r) return 0;
    if (t < t0 + a) return (t - t0) / a;
    if (t > t1) return 1 - (t - t1) / r;
    return 1;
  };
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const m = { A1: 33, E2: 40, F2: 41, G2: 43, A2: 45, C3: 48, D3: 50, E3: 52, F3: 53, G3: 55, A3: 57, Bb3: 58, B3: 59, C4: 60, D4: 62, E4: 64, G4: 67 };
  const CHORDS = [
    { t0: 3.1, t1: 8.5, notes: ['A2', 'E3', 'B3', 'C4'], g: 1 }, // Am9 : découverte
    { t0: 8.5, t1: 13.8, notes: ['F2', 'C3', 'E3', 'A3'], g: 1 }, // Fmaj7 : la recherche
    { t0: 13.85, t1: 19.2, notes: ['C3', 'G3', 'B3', 'D4', 'E4'], g: 1.05 }, // Cmaj9 : la révélation
    { t0: 19.3, t1: 22.0, notes: ['D3', 'F3', 'Bb3', 'A3'], g: 0.9 }, // tension : les leurres
    { t0: 22.1, t1: 24.3, notes: ['E2', 'Bb3'], g: 0.55 }, // alarme
    { t0: 24.4, t1: 27.1, notes: ['F2', 'C3', 'A3', 'E4', 'G4'], g: 1 }, // la collection
    { t0: 27.15, t1: 28.35, notes: ['A2', 'E3', 'C4'], g: 0.7 }, // la promesse
    { t0: 28.45, t1: 29.2, notes: ['C3', 'G3', 'D4', 'E4'], g: 1 }, // signature
  ];
  const kicks = [];
  for (let t = 3.4; t < 19.2; t += 0.6) kicks.push([t, t > 9.7 && t < 13.8 ? 0.15 : 0.11]);
  for (let t = 19.4; t < 22.05; t += 0.46) kicks.push([t, 0.14]);
  const whooshes = [19.08, 24.42, 27.15];
  let noise = 12345;
  const rnd = () => ((noise = (noise * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;
  let lp1 = 0;
  let lp2 = 0;
  let lpw = 0;
  let hpw = 0;

  for (let i = 0; i < N; i++) {
    const t = i / SR;
    let ml = 0;
    let mr = 0;
    // Nappe grave continue (la pièce des coffres).
    const drone = 0.05 * (0.7 + 0.3 * Math.sin(TAU * 0.11 * t)) * Math.min(1, t / 1.2) * (t > 29.2 ? Math.max(0, 1 - (t - 29.2) / 0.7) : 1);
    const d = drone * (Math.sin(TAU * 55 * t) + 0.35 * Math.sin(TAU * 110.3 * t));
    ml += d;
    mr += d;
    // Accords : sinus légèrement désaccordés gauche/droite, attaque lente.
    for (const c of CHORDS) {
      const e = env(t, c.t0, c.t1, 0.9, 1.1);
      if (!e) continue;
      for (const n of c.notes) {
        const f = NOTE(m[n]);
        const g = (0.032 * c.g * e) / Math.sqrt(c.notes.length / 3);
        ml += g * (Math.sin(TAU * f * 0.998 * t) + 0.25 * Math.sin(TAU * f * 2.001 * t));
        mr += g * (Math.sin(TAU * f * 1.002 * t + 0.6) + 0.25 * Math.sin(TAU * f * 1.999 * t));
      }
    }
    // Pulsation sourde (kick doux).
    for (const [k, g] of kicks) {
      const u = t - k;
      if (u < 0 || u > 0.4) continue;
      const f = 45 + 75 * Math.exp(-u * 30);
      const v = g * Math.sin(TAU * f * u) * Math.exp(-u * 9);
      ml += v;
      mr += v;
    }
    // Montée avant l'ouverture, puis impact grave au déverrouillage.
    const n0 = rnd();
    if (t > ev.heroAnchor - 0.3 && t < ev.heroUnlock) {
      const x = (t - (ev.heroAnchor - 0.3)) / (ev.heroUnlock - ev.heroAnchor + 0.3);
      const cut = 0.02 + 0.25 * x * x;
      lp1 += (n0 - lp1) * cut;
      lp2 += (lp1 - lp2) * cut;
      const v = 0.13 * x * x * lp2;
      ml += v;
      mr -= v * 0.6;
    }
    for (const b of [ev.heroUnlock, TL.END_CARD.ringsAt]) {
      const u = t - b;
      if (u >= 0 && u < 1.4) {
        const v = 0.3 * Math.sin(TAU * (38 + 30 * Math.exp(-u * 12)) * u) * Math.exp(-u * 3.2);
        ml += v;
        mr += v;
      }
    }
    // Souffles discrets sous les transitions d'iPhone.
    for (const w of whooshes) {
      const u = t - w;
      if (u < 0 || u > 0.5) continue;
      lpw += (n0 - lpw) * 0.18;
      hpw = n0 - lpw;
      const shape = Math.sin((Math.PI * u) / 0.5) ** 2;
      const v = 0.07 * shape * (lpw * 0.7 + hpw * 0.3);
      ml += v * (1 - u);
      mr += v * u * 2;
    }
    L[i] += ml;
    R[i] += mr;
  }

  /* ───────── Master : limiteur doux, -1 dBFS, fondu final ───────── */
  let peak = 0;
  for (let i = 0; i < N; i++) {
    L[i] = Math.tanh(L[i] * 1.9);
    R[i] = Math.tanh(R[i] * 1.9);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const norm = 0.89 / peak;
  const fadeStart = Math.floor((TL.DURATION - 0.45) * SR);
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + N * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    const f = i > fadeStart ? 1 - (i - fadeStart) / (N - fadeStart) : 1;
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm * f)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm * f)) * 32767), 46 + i * 4);
  }
  const out = path.join(ROOT, '.cache/audio/soundtrack.wav');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  console.log(`› bande-son : ${out} (${TL.DURATION} s, crête normalisée à -1 dBFS)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
