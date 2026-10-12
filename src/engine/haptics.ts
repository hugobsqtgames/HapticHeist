import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { PulseBus } from '@/engine/pulseBus';
import type { Settings } from '@/types/game';

export const swallow = (p: Promise<unknown> | undefined) => {
  if (p && typeof p.catch === 'function') p.catch(() => undefined);
};

export const HapticEngine = {
  enabled: true,
  power: 1 as 0 | 1 | 2,
  lastTick: 0,
  lastAny: 0,
  timers: new Set<ReturnType<typeof setTimeout>>(),

  configure(s: Settings) {
    this.enabled = s.haptics;
    this.power = s.hapticPower;
  },
  can() {
    return this.enabled && Platform.OS !== 'web';
  },
  impact(style: Haptics.ImpactFeedbackStyle) {
    if (this.can()) swallow(Haptics.impactAsync(style));
  },
  notify(type: Haptics.NotificationFeedbackType) {
    if (this.can()) swallow(Haptics.notificationAsync(type));
  },
  selection() {
    if (this.can()) swallow(Haptics.selectionAsync());
  },
  later(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  },
  cancelAll() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
  },

  /** Micro-tic d'engrenage, à chaque cran du cadran. */
  tick() {
    const now = Date.now();
    if (now - this.lastTick < 22) return;
    this.lastTick = now;
    PulseBus.push('tick', 0.22, 'haptic');
    if (this.power === 0) this.selection();
    else if (this.power === 1) this.impact(Haptics.ImpactFeedbackStyle.Light);
    else this.impact(Haptics.ImpactFeedbackStyle.Medium);
  },
  /** Tremblement progressif à l'approche d'une zone (closeness 0 → 1). */
  tremor(closeness: number) {
    PulseBus.push('tremor', 0.3 + closeness * 0.45, 'haptic');
    if (closeness < 0.45) this.selection();
    else if (closeness < 0.8 || this.power === 0) this.impact(Haptics.ImpactFeedbackStyle.Soft);
    else this.impact(this.power === 2 ? Haptics.ImpactFeedbackStyle.Rigid : Haptics.ImpactFeedbackStyle.Soft);
  },
  /** Point d'ancrage véritable : double impulsion lourde et feutrée. */
  anchor() {
    PulseBus.push('anchor', 1.1, 'haptic');
    this.notify(Haptics.NotificationFeedbackType.Success);
  },
  /** Leurre : un choc sec unique, plus métallique. */
  decoy() {
    PulseBus.push('decoy', 1.0, 'haptic');
    this.impact(Haptics.ImpactFeedbackStyle.Heavy);
  },
  holdBroken() {
    PulseBus.push('tick', 0.5, 'haptic');
    this.impact(Haptics.ImpactFeedbackStyle.Rigid);
  },
  unlock() {
    PulseBus.push('unlock', 1.3, 'haptic');
    this.notify(Haptics.NotificationFeedbackType.Success);
    this.later(140, () => this.impact(Haptics.ImpactFeedbackStyle.Heavy));
    this.later(260, () => this.impact(Haptics.ImpactFeedbackStyle.Medium));
  },
  error() {
    PulseBus.push('error', 1.3, 'haptic');
    this.notify(Haptics.NotificationFeedbackType.Error);
    this.later(160, () => this.impact(Haptics.ImpactFeedbackStyle.Heavy));
    this.later(300, () => this.impact(Haptics.ImpactFeedbackStyle.Heavy));
  },
  /** Alerte saccadée agressive (Game Over). */
  alarm(bursts = 12) {
    for (let i = 0; i < bursts; i++) {
      this.later(i * 110 + (i % 3 === 2 ? 60 : 0), () => {
        PulseBus.push('alarm', 1.2, 'haptic');
        this.impact(i % 2 === 0 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Rigid);
      });
    }
    this.later(bursts * 115 + 80, () => this.notify(Haptics.NotificationFeedbackType.Error));
  },
  /** Séquence de déverrouillage de la porte du coffre. */
  vaultOpen() {
    [0, 180, 360, 540].forEach((ms) => this.later(ms, () => this.impact(Haptics.ImpactFeedbackStyle.Heavy)));
    this.later(900, () => this.notify(Haptics.NotificationFeedbackType.Success));
    this.later(1800, () => this.impact(Haptics.ImpactFeedbackStyle.Medium));
  },
  ui() {
    PulseBus.push('ui', 0.2, 'haptic');
    this.selection();
  },
};
