import { Animated, PanResponder, PanResponderInstance } from 'react-native';

import { SoundEngine } from '@/engine/audio/SoundEngine';
import { HapticEngine } from '@/engine/haptics';
import type { Zone, ZoneKind } from '@/types/game';
import { circDist, clamp, lerp, mod, rand } from '@/utils/math';

export interface EngineConfig {
  pins: number;
  decoys: number;
  nearWindow: number;
  lockWindow: number;
  holdMs: number;
  decoyTrapRatio: number;
  sensitivity: number;
  autoRegenerate: boolean;
}

export interface EngineCallbacks {
  onAnchor?: (decoy: boolean) => void;
  onHoldBroken?: (reason: 'moved' | 'tremble' | 'released') => void;
  onPinUnlocked?: (pinIndex: number) => void;
  onAllUnlocked?: () => void;
  onTrap?: () => void;
  onZonesChanged?: (zones: Zone[]) => void;
}

export const DETENT_DEG = 2;
export const MAX_HOLD_VELOCITY = 42; // degrés de cadran par seconde
export const SENSITIVITY_VALUES = [0.38, 0.6, 0.9];

export class LockEngine {
  cfg: EngineConfig;
  cb: EngineCallbacks = {};
  active = false;
  size = 300;

  dialAnim = new Animated.Value(0);
  holdAnim = new Animated.Value(0);
  glowAnim = new Animated.Value(0);

  rotation = 0;
  reading = 0;
  lastAngle: number | null = null;
  touching = false;
  lastMoveT = 0;
  velocity = 0;
  lastDetent = 0;
  lastTickSound = 0;
  cumulative = 0;

  zones: Zone[] = [];
  zoneSeq = 1;
  inZone: Zone | null = null;
  holdStart = 0;
  holdProgress = 0;
  nearestDist = 999;
  nearestKind: ZoneKind | null = null;
  lastTremor = 0;
  cooldownUntil = 0;
  pinIndex = 0;
  cx = 0;
  cy = 0;
  glow = 0;
  raf: number | null = null;
  pan: PanResponderInstance;

  constructor(cfg: EngineConfig) {
    this.cfg = cfg;
    this.pan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        const { pageX, pageY, locationX, locationY } = e.nativeEvent;
        // Centre absolu du cadran déduit de la position relative initiale (fiable sur iOS & Android).
        this.cx = pageX - locationX + this.size / 2;
        this.cy = pageY - locationY + this.size / 2;
        this.touching = true;
        this.lastMoveT = Date.now();
        this.velocity = 0;
        this.lastAngle = this.angleAt(pageX, pageY);
        if (this.inZone) this.holdStart = Date.now();
      },
      onPanResponderMove: (e) => this.handleMove(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease: () => this.release(),
      onPanResponderTerminate: () => this.release(),
    });
  }

  angleAt(x: number, y: number): number | null {
    const dx = x - this.cx;
    const dy = y - this.cy;
    if (Math.hypot(dx, dy) < this.size * 0.11) return null; // zone morte centrale : atan2 instable
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  handleMove(x: number, y: number) {
    if (!this.active) return;
    const a = this.angleAt(x, y);
    if (a == null) {
      this.lastAngle = null;
      return;
    }
    if (this.lastAngle == null) {
      this.lastAngle = a;
      return;
    }
    let d = a - this.lastAngle;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    this.lastAngle = a;
    const delta = d * this.cfg.sensitivity;
    const now = Date.now();
    const dt = Math.max(4, now - this.lastMoveT);
    this.lastMoveT = now;
    const inst = (Math.abs(delta) / dt) * 1000;
    this.velocity = this.velocity * 0.78 + inst * 0.22;

    this.rotation += delta;
    this.cumulative += Math.abs(delta);
    this.reading = mod(-this.rotation, 360);
    this.dialAnim.setValue(this.rotation);

    const detent = Math.floor(this.rotation / DETENT_DEG);
    if (detent !== this.lastDetent) {
      this.lastDetent = detent;
      HapticEngine.tick();
      if (now - this.lastTickSound > 32) {
        this.lastTickSound = now;
        SoundEngine.play('tick', 0.28);
      }
    }
    this.evaluate(now);
  }

  release() {
    this.touching = false;
    this.lastAngle = null;
    if (this.inZone && this.holdProgress > 0.05) this.breakHold('released');
  }

  evaluate(now: number) {
    if (now < this.cooldownUntil) {
      this.nearestDist = 999;
      this.nearestKind = null;
      return;
    }
    let best: Zone | null = null;
    let bestDist = 999;
    for (const z of this.zones) {
      const dd = circDist(this.reading, z.angle);
      if (dd < bestDist) {
        bestDist = dd;
        best = z;
      }
    }
    this.nearestDist = bestDist;
    this.nearestKind = best ? best.kind : null;
    const inLock = !!best && bestDist <= this.cfg.lockWindow;
    if (inLock && best && this.inZone?.id !== best.id) {
      this.inZone = best;
      this.holdStart = now;
      this.holdProgress = 0;
      if (best.kind === 'target') {
        HapticEngine.anchor();
        SoundEngine.play('anchor', 0.75);
      } else {
        HapticEngine.decoy();
        SoundEngine.play('decoy', 0.75);
      }
      this.cb.onAnchor?.(best.kind === 'decoy');
    } else if (!inLock && this.inZone) {
      if (this.holdProgress > 0.08) this.breakHold('moved');
      this.inZone = null;
    }
  }

  breakHold(reason: 'moved' | 'tremble' | 'released') {
    this.holdProgress = 0;
    this.holdStart = Date.now();
    this.holdAnim.setValue(0);
    HapticEngine.holdBroken();
    SoundEngine.play('reset', 0.5);
    this.cb.onHoldBroken?.(reason);
  }

  frame = () => {
    const now = Date.now();
    if (this.active) {
      if (now - this.lastMoveT > 45) this.velocity *= 0.82;

      if (this.inZone && this.touching) {
        if (this.velocity > MAX_HOLD_VELOCITY) {
          if (this.holdProgress > 0.1) this.breakHold('tremble');
          else this.holdStart = now;
        }
        this.holdProgress = clamp((now - this.holdStart) / this.cfg.holdMs, 0, 1);
        this.holdAnim.setValue(this.holdProgress);
        if (this.inZone.kind === 'decoy' && this.holdProgress >= this.cfg.decoyTrapRatio) this.trap(now);
        else if (this.inZone.kind === 'target' && this.holdProgress >= 1) this.unlockPin(now);
      } else if (this.holdProgress > 0) {
        this.holdProgress = Math.max(0, this.holdProgress - 0.08);
        this.holdAnim.setValue(this.holdProgress);
      }

      if (this.touching && !this.inZone && this.nearestDist <= this.cfg.nearWindow && now >= this.cooldownUntil) {
        const span = Math.max(0.5, this.cfg.nearWindow - this.cfg.lockWindow);
        const closeness = clamp(1 - (this.nearestDist - this.cfg.lockWindow) / span, 0, 1);
        const interval = lerp(190, 55, closeness);
        if (now - this.lastTremor > interval) {
          this.lastTremor = now;
          HapticEngine.tremor(closeness);
        }
      }

      const targetGlow = this.inZone ? 1 : 0;
      if (Math.abs(this.glow - targetGlow) > 0.01) {
        this.glow = lerp(this.glow, targetGlow, 0.25);
        this.glowAnim.setValue(this.glow);
      }
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  unlockPin(now: number) {
    this.inZone = null;
    this.holdProgress = 0;
    this.holdAnim.setValue(0);
    HapticEngine.unlock();
    SoundEngine.play('unlock', 0.9);
    const idx = this.pinIndex;
    this.pinIndex += 1;
    this.cooldownUntil = now + 500;
    this.cb.onPinUnlocked?.(idx);
    if (this.pinIndex >= this.cfg.pins) {
      this.zones = [];
      this.cb.onZonesChanged?.(this.zones);
      this.cb.onAllUnlocked?.();
    } else if (this.cfg.autoRegenerate) {
      this.regenerate();
    }
  }

  trap(now: number) {
    const z = this.inZone;
    this.inZone = null;
    this.holdProgress = 0;
    this.holdAnim.setValue(0);
    this.cooldownUntil = now + 900;
    HapticEngine.error();
    SoundEngine.play('error', 0.85);
    if (z) {
      this.zones = this.zones.map((zz) => (zz.id === z.id ? { ...zz, id: this.zoneSeq++, angle: this.freeAngle(this.zones, zz.id) } : zz));
      this.cb.onZonesChanged?.(this.zones);
    }
    this.cb.onTrap?.();
  }

  freeAngle(existing: Zone[], ignoreId = -1): number {
    for (let tries = 0; tries < 200; tries++) {
      const a = Math.round(rand(0, 359));
      const okReading = circDist(a, this.reading) > 40;
      const okOthers = existing.every((z) => z.id === ignoreId || circDist(a, z.angle) > 26);
      if (okReading && okOthers) return a;
    }
    return mod(this.reading + 180, 360);
  }

  regenerate() {
    const zones: Zone[] = [];
    zones.push({ id: this.zoneSeq++, angle: this.freeAngle(zones), kind: 'target' });
    for (let i = 0; i < this.cfg.decoys; i++) zones.push({ id: this.zoneSeq++, angle: this.freeAngle(zones), kind: 'decoy' });
    this.zones = zones;
    this.inZone = null;
    this.cb.onZonesChanged?.(zones);
  }

  setZones(spec: { angle: number; kind: ZoneKind }[]) {
    this.zones = spec.map((s) => ({ id: this.zoneSeq++, angle: mod(Math.round(s.angle), 360), kind: s.kind }));
    this.inZone = null;
    this.holdProgress = 0;
    this.holdAnim.setValue(0);
    this.cb.onZonesChanged?.(this.zones);
  }

  reset() {
    this.pinIndex = 0;
    this.inZone = null;
    this.holdProgress = 0;
    this.holdAnim.setValue(0);
    this.cumulative = 0;
    this.cooldownUntil = 0;
  }

  start() {
    if (this.raf == null) this.raf = requestAnimationFrame(this.frame);
  }
  stop() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }
}
