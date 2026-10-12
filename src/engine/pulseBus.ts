

export type PulseKind = 'tick' | 'tremor' | 'anchor' | 'decoy' | 'unlock' | 'error' | 'alarm' | 'ui';
export type PulseListener = (kind: PulseKind, energy: number, channel: 'haptic' | 'audio') => void;

export const PulseBus = {
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
