import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, BackHandler, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AngleReadout, LivesDots, PinRow, SimulatorFlash, TimerBar, Waveform } from '@/components/heist/Hud';
import { LockDial } from '@/components/heist/LockDial';
import { Button, IconButton } from '@/components/ui/Button';
import { SoundEngine } from '@/engine/audio/SoundEngine';
import { HapticEngine } from '@/engine/haptics';
import { EngineConfig, SENSITIVITY_VALUES } from '@/engine/lock/LockEngine';
import { useLockEngine } from '@/engine/lock/useLockEngine';
import { getHeistConfig } from '@/game/content';
import { useCareer, useGame } from '@/state/GameProvider';
import { C, GUTTER, R, T } from '@/theme';
import type { Zone } from '@/types/game';

type Phase = 'intro' | 'playing' | 'paused' | 'cracked' | 'busted';
const IDLE_STATUS: { text: string; color: string } = { text: 'Cherchez le point d’ancrage', color: C.text2 };

export function HeistScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const career = useCareer();
  const { heistLevel, recordSuccess, recordFailure } = useGame();
  const settings = career.settings;
  const cfg = useMemo(() => getHeistConfig(heistLevel), [heistLevel]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [count, setCount] = useState(3);
  const [pinsDone, setPinsDone] = useState(0);
  const [lives, setLives] = useState(cfg.lives);
  const [errorKey, setErrorKey] = useState(0);
  const [status, setStatus] = useState(IDLE_STATUS);
  const [zones, setZones] = useState<Zone[]>([]);
  const redFlash = useRef(new Animated.Value(0)).current;
  const accentFlash = useRef(new Animated.Value(0)).current;

  const clock = useRef({ startedAt: 0, pausedAcc: 0, pausedAt: 0, traps: 0, ended: false, lastBeat: 0 }).current;
  const livesRef = useRef(lives);
  livesRef.current = lives;
  const pinsRef = useRef(pinsDone);
  pinsRef.current = pinsDone;

  const elapsed = useCallback(() => {
    if (!clock.startedAt) return 0;
    const now = clock.pausedAt || Date.now();
    return now - clock.startedAt - clock.pausedAcc;
  }, [clock]);

  const dialSize = Math.min(width - GUTTER * 2, height * 0.44, 380);
  const accent = cfg.tier.accent;

  const flashStatus = useCallback(
    (text: string, color: string, resetMs = 0) => {
      setStatus({ text, color });
      if (resetMs > 0) setTimeout(() => !clock.ended && setStatus(IDLE_STATUS), resetMs);
    },
    [clock],
  );

  const finishFail = useCallback(
    (reason: 'traps' | 'time') => {
      if (clock.ended) return;
      clock.ended = true;
      setPhase('busted');
      HapticEngine.alarm(10);
      SoundEngine.startLoop('siren', 0.8);
      setStatus({ text: reason === 'time' ? 'Temps écoulé' : 'Alarme déclenchée', color: C.red });
      Animated.loop(
        Animated.sequence([
          Animated.timing(redFlash, { toValue: 0.4, duration: 160, useNativeDriver: true }),
          Animated.timing(redFlash, { toValue: 0.05, duration: 160, useNativeDriver: true }),
        ]),
        { iterations: 5 },
      ).start();
      const t = elapsed();
      setTimeout(() => {
        recordFailure({
          level: cfg.level,
          success: false,
          timeMs: t,
          pinsDone: pinsRef.current,
          pinsTotal: cfg.pins,
          traps: clock.traps,
          livesLeft: livesRef.current,
          reason,
          tierName: cfg.tier.name,
          lootLostEstimate: Math.round((cfg.lootMin + cfg.lootMax) / 2 / 1000) * 1000,
        });
        router.replace('/busted');
      }, 1600);
    },
    [cfg, clock, elapsed, recordFailure, redFlash],
  );

  const engineCfg = useMemo<EngineConfig>(
    () => ({
      pins: cfg.pins,
      decoys: cfg.decoys,
      nearWindow: cfg.nearWindow + (settings.cheat ? 2 : 0),
      lockWindow: cfg.lockWindow + (settings.cheat ? 1 : 0),
      holdMs: cfg.holdMs,
      decoyTrapRatio: cfg.decoyTrapRatio,
      sensitivity: SENSITIVITY_VALUES[settings.sensitivity],
      autoRegenerate: true,
    }),
    [cfg, settings.cheat, settings.sensitivity],
  );

  const engine = useLockEngine(
    engineCfg,
    {
      onAnchor: () => setStatus({ text: 'Ancrage — ne bougez plus', color: accent }),
      onHoldBroken: (reason) =>
        flashStatus(reason === 'released' ? 'Doigt levé — goupille réinitialisée' : reason === 'tremble' ? 'Tremblement — goupille réinitialisée' : 'Glissement — goupille réinitialisée', C.red, 1200),
      onPinUnlocked: (idx) => {
        setPinsDone(idx + 1);
        accentFlash.setValue(0.25);
        Animated.timing(accentFlash, { toValue: 0, duration: 600, useNativeDriver: true }).start();
        if (idx + 1 < cfg.pins) flashStatus(`Goupille ${idx + 1} débloquée`, C.green, 1300);
      },
      onAllUnlocked: () => {
        if (clock.ended) return;
        clock.ended = true;
        setPhase('cracked');
        setStatus({ text: 'Mécanisme ouvert', color: C.green });
        SoundEngine.play('bolt', 1);
        setTimeout(() => SoundEngine.play('bolt', 1), 220);
        const t = elapsed();
        setTimeout(() => {
          recordSuccess({
            level: cfg.level,
            success: true,
            timeMs: t,
            pinsDone: cfg.pins,
            pinsTotal: cfg.pins,
            traps: clock.traps,
            livesLeft: livesRef.current,
            reason: 'success',
            tierName: cfg.tier.name,
            lootLostEstimate: 0,
          });
          router.replace('/success');
        }, 1000);
      },
      onTrap: () => {
        clock.traps += 1;
        setErrorKey((k) => k + 1);
        redFlash.setValue(0.35);
        Animated.timing(redFlash, { toValue: 0, duration: 700, useNativeDriver: true }).start();
        const left = livesRef.current - 1;
        setLives(left);
        if (left <= 0) finishFail('traps');
        else flashStatus(`Leurre — ${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}`, C.red, 1600);
      },
      onZonesChanged: (z) => setZones([...z]),
    },
    phase === 'playing',
    dialSize,
  );

  // Compte à rebours d'introduction
  useEffect(() => {
    if (phase !== 'intro') return;
    if (count <= 0) {
      engine.reset();
      engine.regenerate();
      clock.startedAt = Date.now();
      setPhase('playing');
      setStatus(IDLE_STATUS);
      HapticEngine.impact(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }
    HapticEngine.impact(Haptics.ImpactFeedbackStyle.Medium);
    SoundEngine.play('ui', 0.8);
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, count, engine, clock]);

  // Chrono, battements de cœur & fin du temps
  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setInterval(() => {
      if (cfg.timeLimitMs <= 0 || clock.ended) return;
      const left = cfg.timeLimitMs - elapsed();
      if (left <= 0) finishFail('time');
      else if (left < 15000 || livesRef.current === 1) {
        const now = Date.now();
        const period = left < 8000 ? 520 : 820;
        if (now - clock.lastBeat > period) {
          clock.lastBeat = now;
          SoundEngine.play('heartbeat', left < 8000 ? 0.9 : 0.6);
        }
      }
    }, 100);
    return () => clearInterval(t);
  }, [phase, cfg.timeLimitMs, clock, elapsed, finishFail]);

  const pause = useCallback(() => {
    if (phase !== 'playing') return;
    clock.pausedAt = Date.now();
    engine.release();
    setPhase('paused');
  }, [phase, clock, engine]);

  const resume = useCallback(() => {
    if (clock.pausedAt) clock.pausedAcc += Date.now() - clock.pausedAt;
    clock.pausedAt = 0;
    setPhase('playing');
  }, [clock]);

  // Pause automatique en arrière-plan ; le retour Android met en pause au lieu de quitter
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s !== 'active' && pause());
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      pause();
      return true;
    });
    return () => {
      sub.remove();
      back.remove();
    };
  }, [pause]);

  useEffect(
    () => () => {
      clock.ended = true;
      HapticEngine.cancelAll();
    },
    [clock],
  );

  const getStatus = useCallback(
    () => ({ leftMs: cfg.timeLimitMs > 0 ? Math.max(0, cfg.timeLimitMs - elapsed()) : 0, limitMs: cfg.timeLimitMs, lives: livesRef.current, maxLives: cfg.lives }),
    [cfg, elapsed],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.top}>
        <IconButton icon="pause" label="Pause" onPress={pause} />
        <View style={{ flex: 1, alignItems: 'center', paddingLeft: 24 }}>
          <Text style={T.headline} numberOfLines={1}>
            {cfg.tier.name}
          </Text>
          <Text style={T.footnote}>Niveau {cfg.level}</Text>
        </View>
        <LivesDots lives={lives} max={cfg.lives} />
      </View>

      <View style={{ marginTop: 20, gap: 16 }}>
        <TimerBar getStatus={getStatus} accent={accent} />
        <PinRow total={cfg.pins} done={pinsDone} errorKey={errorKey} accent={accent} />
      </View>

      <Text style={[T.callout, styles.status, { color: status.color }]} numberOfLines={1} adjustsFontSizeToFit>
        {status.text}
      </Text>

      <View style={styles.dialWrap}>
        <LockDial size={dialSize} engine={engine} accent={accent} markers={settings.cheat ? zones : null} />
      </View>

      <View style={styles.bottom}>
        <View style={{ flex: 1 }}>
          <Waveform width={width - GUTTER * 2 - 32 - 92} blind={settings.blind} />
        </View>
        <AngleReadout engine={engine} blind={settings.blind} cheat={settings.cheat} />
      </View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: C.red, opacity: redFlash }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: accent, opacity: accentFlash }]} />
      <SimulatorFlash enabled={settings.simulator} />

      {phase === 'intro' ? (
        <View style={styles.overlay}>
          <Text style={T.subhead}>Infiltration</Text>
          <Text style={styles.count}>{count > 0 ? count : ''}</Text>
          <Text style={T.subhead}>
            {cfg.pins} goupille{cfg.pins > 1 ? 's' : ''}
            {cfg.decoys > 0 ? ` · ${cfg.decoys} leurre${cfg.decoys > 1 ? 's' : ''}` : ''}
            {cfg.timeLimitMs > 0 ? ` · ${Math.round(cfg.timeLimitMs / 1000)} s` : ''}
          </Text>
        </View>
      ) : null}

      {phase === 'paused' ? (
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={T.title2}>Pause</Text>
            <Text style={[T.subhead, { textAlign: 'center' }]}>Le chrono est arrêté. Le cadran garde sa position.</Text>
            <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 8 }}>
              <Button label="Reprendre" icon="play" onPress={resume} />
              <Button
                label="Abandonner"
                variant="secondary"
                onPress={() => {
                  clock.ended = true;
                  router.back();
                }}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER, gap: 12 },
  status: { textAlign: 'center', marginTop: 20, paddingHorizontal: GUTTER, fontWeight: '500' },
  dialWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: GUTTER, padding: 16, borderRadius: R.lg - 4, backgroundColor: C.surface2 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.86)', alignItems: 'center', justifyContent: 'center', gap: 4, padding: GUTTER },
  count: { color: C.text, fontSize: 96, lineHeight: 110, fontWeight: '700', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  sheet: { width: '100%', maxWidth: 380, alignItems: 'center', gap: 8, padding: 24, borderRadius: R.xl, backgroundColor: C.surface2 },
});
