import { File, Paths } from 'expo-file-system';

import { clamp, mulberry32, TAU } from '@/utils/math';

export const SR = 22050;

export type SoundName =
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

export const synth = (dur: number, fn: (t: number, i: number) => number) => {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i);
  return out;
};
export const sin = (f: number, t: number) => Math.sin(TAU * f * t);

export const SOUND_DEFS: Record<SoundName, { pool: number; loop?: boolean; gen: () => Float32Array }> = {
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

export function encodeWav(samples: Float32Array): Uint8Array {
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

export const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toBase64(bytes: Uint8Array): string {
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
export function persistWav(name: string, bytes: Uint8Array): string {
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
