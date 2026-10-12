import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { SOUND_DEFS, SoundName, encodeWav, persistWav } from '@/engine/audio/synth';
import { swallow } from '@/engine/haptics';
import { PulseBus } from '@/engine/pulseBus';
import type { Settings } from '@/types/game';
import { clamp } from '@/utils/math';

export const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0));

export const SoundEngine = {
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
